"use client";

import Image from "next/image";

interface CreatorAvatarProps {
  /** Wallet address or display name — first two chars are used as fallback initials. */
  address: string;
  /** Optional URL of a profile image. When present, renders via next/image. */
  src?: string | null;
  /** Rendered size in px (both width and height). Defaults to 40. */
  size?: number;
  className?: string;
}

/**
 * Creator avatar with automatic Next.js image optimisation.
 *
 * #631 — Raw <img> tags for external avatar URLs skip Next.js's image pipeline,
 * so the browser downloads the original file (potentially several MB) and
 * resizes it in software. Using <Image> with fixed width/height lets Next.js
 * serve a correctly-sized WebP/AVIF from its built-in optimiser instead.
 *
 * When no avatar URL is available the component falls back to a gradient div
 * that shows the first two characters of the wallet address.
 */
export default function CreatorAvatar({
  address,
  src,
  size = 40,
  className = "",
}: CreatorAvatarProps) {
  const initials = address.slice(1, 3).toUpperCase();
  const style = { width: size, height: size };

  if (src) {
    return (
      <Image
        src={src}
        alt={`${initials} profile picture`}
        width={size}
        height={size}
        className={`rounded-full object-cover ring-2 ring-white dark:ring-zinc-700 ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-linear-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-inner ring-2 ring-white dark:ring-zinc-700 ${className}`}
      style={{ ...style, fontSize: size * 0.35 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
