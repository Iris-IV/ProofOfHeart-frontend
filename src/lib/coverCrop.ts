/**
 * Cover images are shown in campaign cards with `aspect-video` (16:9), so the
 * upload is centre-cropped to that ratio before it is optimized and sent to IPFS.
 */
export const COVER_ASPECT = 16 / 9;

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Largest centred rectangle with the requested aspect ratio that fits inside a
 * `width` x `height` image. Returns the full image when it already matches.
 */
export function centerCropRect(width: number, height: number, aspect = COVER_ASPECT): CropRect {
  if (width <= 0 || height <= 0)
    return { sx: 0, sy: 0, sw: Math.max(0, width), sh: Math.max(0, height) };

  if (width / height > aspect) {
    const sw = Math.round(height * aspect);
    return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: height };
  }

  const sh = Math.round(width / aspect);
  return { sx: 0, sy: Math.round((height - sh) / 2), sw: width, sh };
}

/** Types that are passed through untouched: SVG has no pixel grid, GIF may be animated. */
const PASSTHROUGH_TYPES = new Set(["image/svg+xml", "image/gif"]);

/**
 * Centre-crops an image file to COVER_ASPECT in the browser. Returns the original
 * file when it already matches, cannot be decoded, or cannot be encoded, so an
 * upload is never blocked by this step.
 */
export async function cropCoverToAspect(file: File): Promise<File> {
  if (PASSTHROUGH_TYPES.has(file.type) || typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { sx, sy, sw, sh } = centerCropRect(bitmap.width, bitmap.height);

    if (sw === bitmap.width && sh === bitmap.height) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type));
    if (!blob) return file;

    return new File([blob], file.name, { type: blob.type || file.type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
