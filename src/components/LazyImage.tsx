"use client";

import { useRef, useState, useEffect, type ImgHTMLAttributes } from "react";

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  blurHash?: string;
  placeholderUrl?: string;
}

export default function LazyImage({
  src,
  alt,
  blurHash,
  placeholderUrl,
  className,
  onLoad,
  ...rest
}: LazyImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    if (!("IntersectionObserver" in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const defaultPlaceholder =
    placeholderUrl ||
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3C/svg%3E";

  return (
    <div className="relative inline-block overflow-hidden w-full h-full">
      {!isLoaded && (
        <img
          src={defaultPlaceholder}
          alt={`Placeholder for ${alt}`}
          className={`absolute inset-0 w-full h-full object-cover filter blur-sm transition-opacity duration-300 ${
            blurHash ? "opacity-90" : "opacity-50"
          }`}
          aria-hidden="true"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={isInView ? src : undefined}
        alt={alt}
        className={`${className || ""} transition-opacity duration-300 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        onLoad={handleLoad}
        {...rest}
      />
    </div>
  );
}
