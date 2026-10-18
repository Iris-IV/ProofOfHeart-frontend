import { optimizeCoverImage } from "@/lib/imageOptimization";

function makeFile(bytes: number, type: string, name = "cover.jpg"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("optimizeCoverImage", () => {
  let bitmap: { width: number; height: number; close: jest.Mock };
  let encode: (type: string, quality?: number) => Blob | null;

  beforeEach(() => {
    bitmap = { width: 4000, height: 3000, close: jest.fn() };
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = jest
      .fn()
      .mockResolvedValue(bitmap);

    // Default: the browser honours every requested encoding.
    encode = (type) => new Blob([new Uint8Array(1000)], { type });

    jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage: jest.fn() } as unknown as CanvasRenderingContext2D);

    jest.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      cb: BlobCallback,
      type?: string,
      quality?: number,
    ) {
      cb(encode(type ?? "image/png", quality));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as { createImageBitmap?: unknown }).createImageBitmap;
  });

  it("downscales a large image and encodes it as WebP", async () => {
    const input = makeFile(200_000, "image/jpeg", "photo.jpg");

    const out = await optimizeCoverImage(input);

    expect(out).not.toBe(input);
    expect(out.type).toBe("image/webp");
    expect(out.name).toBe("photo.webp");
    expect(out.size).toBeLessThan(input.size);

    // 4000x3000 clamped to a 1600px longest edge -> 1600x1200.
    const ctx = (HTMLCanvasElement.prototype.getContext as jest.Mock).mock.results[0].value;
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1200);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("does not upscale an image already within the max edge", async () => {
    bitmap.width = 800;
    bitmap.height = 600;

    await optimizeCoverImage(makeFile(200_000, "image/jpeg"));

    const ctx = (HTMLCanvasElement.prototype.getContext as jest.Mock).mock.results[0].value;
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 800, 600);
  });

  it("falls back to JPEG when the browser cannot encode WebP", async () => {
    encode = (type) =>
      type === "image/webp"
        ? new Blob([new Uint8Array(1000)], { type: "image/png" })
        : new Blob([new Uint8Array(1200)], { type });

    const out = await optimizeCoverImage(makeFile(200_000, "image/jpeg", "photo.jpg"));

    expect(out.type).toBe("image/jpeg");
    expect(out.name).toBe("photo.jpg");
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/webp",
      expect.any(Number),
    );
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/jpeg",
      expect.any(Number),
    );
  });

  it.each(["image/svg+xml", "image/gif"])("passes %s through untouched", async (type) => {
    const input = makeFile(10_000, type, "art");

    const out = await optimizeCoverImage(input);

    expect(out).toBe(input);
    expect(globalThis.createImageBitmap).not.toHaveBeenCalled();
  });

  it("keeps the original when re-encoding would not reduce the size", async () => {
    encode = (type) => new Blob([new Uint8Array(500_000)], { type });
    const input = makeFile(200_000, "image/jpeg");

    expect(await optimizeCoverImage(input)).toBe(input);
  });

  it("returns the original file when decoding fails", async () => {
    (globalThis.createImageBitmap as jest.Mock).mockRejectedValue(new Error("boom"));
    const input = makeFile(200_000, "image/jpeg");

    expect(await optimizeCoverImage(input)).toBe(input);
  });

  it("returns the original file when no 2D context is available", async () => {
    (HTMLCanvasElement.prototype.getContext as jest.Mock).mockReturnValue(null);
    const input = makeFile(200_000, "image/jpeg");

    expect(await optimizeCoverImage(input)).toBe(input);
  });
});
