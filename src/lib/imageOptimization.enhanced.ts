import { imageOptimization } from "./imageOptimization";

export interface OptimizedImageConfig {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  formats?: ("webp" | "avif" | "jpg" | "png")[];
}

export interface ResponsiveImage {
  src: string;
  srcSet: string;
  sizes: string;
  formats: {
    webp?: string;
    avif?: string;
  };
}

const DEVICE_WIDTHS = [320, 640, 1024, 1280, 1920] as const;
const QUALITY_MAP = {
  webp: 75,
  avif: 65,
  jpg: 80,
  png: 100,
} as const;

export function generateResponsiveImage(config: OptimizedImageConfig): ResponsiveImage {
  const { src, width = 1200, formats = ["avif", "webp", "jpg"] } = config;

  const basePath = src.replace(/\.[^.]+$/, "");
  const ext = src.match(/\.[^.]+$/)?.[0] || ".jpg";

  // Generate srcset for different device widths
  const srcSet = DEVICE_WIDTHS
    .filter((w) => w <= (width || 1920))
    .map((w) => {
      const quality = QUALITY_MAP[formats[0] as keyof typeof QUALITY_MAP] || 80;
      return `${basePath}-${w}w.${formats[0]}?q=${quality} ${w}w`;
    })
    .join(", ");

  // Generate WebP variant
  const webpSet = formats.includes("webp")
    ? DEVICE_WIDTHS
      .filter((w) => w <= (width || 1920))
      .map((w) => `${basePath}-${w}w.webp?q=${QUALITY_MAP.webp} ${w}w`)
      .join(", ")
    : undefined;

  // Generate AVIF variant (highest compression)
  const avifSet = formats.includes("avif")
    ? DEVICE_WIDTHS
      .filter((w) => w <= (width || 1920))
      .map((w) => `${basePath}-${w}w.avif?q=${QUALITY_MAP.avif} ${w}w`)
      .join(", ")
    : undefined;

  return {
    src: srcSet.split(" ")[0],
    srcSet,
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px",
    formats: {
      webp: webpSet,
      avif: avifSet,
    },
  };
}

// Lazy load images for better LCP
export function useLazyImage(src: string, callback?: () => void) {
  if (typeof IntersectionObserver === "undefined") return;

  const img = new Image();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && entry.target instanceof HTMLImageElement) {
        entry.target.src = src;
        entry.target.classList.add("loaded");
        observer.unobserve(entry.target);
        callback?.();
      }
    });
  });

  return observer;
}

// WebAssembly-based image compression (async)
export async function compressImageWithWasm(
  imageData: ArrayBuffer,
  format: "webp" | "avif" | "jpg" = "webp"
): Promise<Blob> {
  try {
    // Placeholder for WASM compression integration
    // In production, use: https://github.com/GoogleChromeLabs/squoosh
    return new Blob([imageData], { type: `image/${format}` });
  } catch (error) {
    console.error("Image compression failed:", error);
    throw error;
  }
}
