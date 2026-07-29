import { getYoutubeEmbedUrl, isDirectVideoUrl, normalizeVideoUrl } from "@/lib/videoEmbeds";

describe("videoEmbeds", () => {
  it("normalizes http and https URLs", () => {
    expect(normalizeVideoUrl(" https://example.com/video.mp4 ")).toBe("https://example.com/video.mp4");
    expect(normalizeVideoUrl("http://example.com/video.mp4")).toBe("http://example.com/video.mp4");
  });

  it("rejects non-http URLs", () => {
    expect(normalizeVideoUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeVideoUrl("data:text/plain,hello")).toBeNull();
  });

  it("builds YouTube embed URLs only for valid IDs", () => {
    expect(getYoutubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(getYoutubeEmbedUrl("https://www.youtube.com/watch?v=invalid-id")).toBeNull();
  });

  it("detects direct video URLs only on http and https", () => {
    expect(isDirectVideoUrl("https://cdn.example.com/demo.mp4")).toBe(true);
    expect(isDirectVideoUrl("ftp://cdn.example.com/demo.mp4")).toBe(false);
  });
});
