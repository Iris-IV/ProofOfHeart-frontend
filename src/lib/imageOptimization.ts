/**
 * Client-side cover-image optimization (issue #1149).
 *
 * Campaign covers are uploaded straight to IPFS and rendered with Next image
 * optimization disabled (`images.unoptimized` in `next.config.ts`), so whatever
 * bytes a creator picks are exactly what every viewer downloads. This module
 * downscales and re-encodes the file in the browser before upload: it prefers
 * WebP and falls back to a compressed JPEG when the browser cannot encode WebP.
 *
 * It never throws — any failure returns the original `File` so uploads keep
 * working. The output is still validated by `validateImageFile` at the call
 * site (WebP and JPEG are both on the allow-list).
 */

/** Longest edge (px) the image is scaled down to. Images already smaller are left as-is. */
const MAX_EDGE = 1600;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.85;

/** Passed through untouched: SVG is already tiny, GIF may be animated. */
const SKIP_TYPES = new Set(["image/svg+xml", "image/gif"]);

interface DecodedImage {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  close: () => void;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof globalThis.createImageBitmap === "function") {
    const bitmap = await globalThis.createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close(),
    };
  }

  // Fallback for browsers without createImageBitmap (older Safari).
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to decode image"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      close: () => {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function targetSize(width: number, height: number): { w: number; h: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE || longest === 0) return { w: width, h: height };
  const scale = MAX_EDGE / longest;
  return { w: Math.round(width * scale), h: Math.round(height * scale) };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
}

function renameForType(name: string, type: string): string {
  const ext = type === "image/webp" ? "webp" : "jpg";
  const base = name.replace(/\.[^./\\]+$/, "").trim();
  return `${base || "cover"}.${ext}`;
}

/**
 * Returns a downscaled WebP (or JPEG fallback) version of `file`, or the
 * original `file` when it is already small enough, cannot be processed, or the
 * re-encoded result would not be smaller.
 */
export async function optimizeCoverImage(file: File): Promise<File> {
  if (SKIP_TYPES.has(file.type)) return file;

  try {
    const decoded = await decodeImage(file);
    const { w, h } = targetSize(decoded.width, decoded.height);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      decoded.close();
      return file;
    }
    decoded.draw(ctx, w, h);
    decoded.close();

    let blob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
    if (!blob || blob.type !== "image/webp") {
      // Browser ignored the WebP request (e.g. Safari < 16) — use JPEG.
      blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    }

    if (!blob || (blob.type !== "image/webp" && blob.type !== "image/jpeg")) {
      return file;
    }
    if (blob.size >= file.size) return file;

    return new File([blob], renameForType(file.name, blob.type), {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
