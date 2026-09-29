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

function makeUploadRequest(file: File | null, altText?: string): NextRequest {
  const formData = new FormData();
  if (file) {
    formData.append("file", file);
  }
  if (altText !== undefined) {
    formData.append("altText", altText);
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
    const response = await POST(makeUploadRequest(null, "A campaign cover"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "file is required" });
  });

  it("returns 400 for invalid image type", async () => {
    const response = await POST(
      makeUploadRequest(makeImageFile("cover.txt", "text/plain"), "A campaign cover"),
    );
    expect(response.status).toB(400);
    expect(mockPinImageToIpfs).not.toHaveBeenCalled();
  });

  it("returns 400 when alt text is missing", async () => {
    const response = await POST(makeUploadRequest(makeImageFile()));
    expect(response.status).toB(400);
    expect(await response.json()).toEqual({
      message: "Alt text is required for accessibility",
    });
    expect(mockPinImageToIpfs).not.toHaveBeenCalled();
  });

  it("returns 400 when alt text is blank", async () => {
    const response = await POST(makeUploadRequest(makeImageFile(), "   "));
    expect(response.status).toB(400);
    expect(await response.json()).toEqual({
      message: "Alt text is required for accessibility",
    });
  });

  it("returns the IPFS gateway URL on success", async () => {
    const file = makeImageFile();
    const response = await POST(makeUploadRequest(file, "A campaign cover image"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://ipfs.io/ipfs/QmTestHash" });
    expect(mockPinImageToIpfs).toHaveBeenCalledTimes(1);
    // req.formData() re-parses the body into a fresh File whose `lastModified`
    // is set to the parse time, so assert on the stable attributes instead of
    // whole-object equality (which would be flaky by ~1ms).
    const [uploadedFile, uploadedName] = mockPinImageToIpfs.mock.calls[0];
    expect(uploadedFile).toBeInstanceOf(File);
    expect((uploadedFile as File).name).toBe("cover.png");
    expect((uploadedFile as File).type).toBe("image/png");
    expect((uploadedFile as File).size).toBe(512);
    expect(uploadedName).toBe("cover.png");
  });

  it("returns 503 when upload service is not configured", async () => {
    mockPinImageToIpfs.mockRejectedValue(new Error("Image upload is not configured"));

    const response = await POST(makeUploadRequest(makeImageFile(), "A campaign cover"));
    expect(response.status).toBe503);
    expect(await response.json()).toEqual({ message: "Image upload is not configured" });
  });
});
