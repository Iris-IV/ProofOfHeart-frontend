/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/upload-image/route";
import { pinImageToIpfs } from "@/lib/ipfsUpload";

jest.mock("@/lib/ipfsUpload", () => ({
  pinImageToIpfs: jest.fn(),
}));

const mockPinImageToIpfs = pinImageToIpfs as jest.MockedFunction<typeof pinImageToIpfs>;

function makeImageFile(name = "cover.png", type = "image/png", size = 512): File {
  const bytes = new Uint8Array(size).fill(1);
  return new File([bytes], name, { type });
}

function makeUploadRequest(file: File | null): NextRequest {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }

  return new NextRequest("http://localhost/api/upload-image", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/upload-image", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPinImageToIpfs.mockResolvedValue("https://ipfs.io/ipfs/QmTestHash");
  });

  it("returns 400 when file is missing", async () => {
    const response = await POST(makeUploadRequest(null));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "file is required" });
  });

  it("returns 400 for invalid image type", async () => {
    const response = await POST(makeUploadRequest(makeImageFile("cover.txt", "text/plain")));
    expect(response.status).toBe(400);
    expect(mockPinImageToIpfs).not.toHaveBeenCalled();
  });

  it("returns the IPFS gateway URL on success", async () => {
    const file = makeImageFile();
    const response = await POST(makeUploadRequest(file));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://ipfs.io/ipfs/QmTestHash" });
    expect(mockPinImageToIpfs).toHaveBeenCalledWith(file, "cover.png");
  });

  it("returns 503 when upload service is not configured", async () => {
    mockPinImageToIpfs.mockRejectedValue(new Error("Image upload is not configured"));

    const response = await POST(makeUploadRequest(makeImageFile()));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: "Image upload is not configured" });
  });
});
