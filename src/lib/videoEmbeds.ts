const YOUTUBE_HOSTNAMES = new Set([
  "youtu.be",
  "www.youtu.be",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const DIRECT_VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov", ".m4v", ".m3u8"];

function isHttpOrHttpsUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

export function normalizeVideoUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (!isHttpOrHttpsUrl(url)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function getYoutubeEmbedUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    if (!isHttpOrHttpsUrl(url) || !YOUTUBE_HOSTNAMES.has(url.hostname)) {
      return null;
    }

    let videoId: string | null = null;

    if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.split("/")[2] ?? null;
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/")[2] ?? null;
    }

    if (!videoId) return null;
    if (!YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      return null;
    }

    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

export function isDirectVideoUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!isHttpOrHttpsUrl(url)) {
      return false;
    }
    const pathname = url.pathname.toLowerCase();
    return DIRECT_VIDEO_EXTENSIONS.some((extension) => pathname.endsWith(extension));
  } catch {
    return false;
  }
}
