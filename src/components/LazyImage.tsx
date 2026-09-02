"use client";

import { useRef, useState, useEffect, type ImgHTMLAttributes } from "react";

interface LazyImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

export default function LazyImage({ src, alt, className, onLoad, ...rest }: LazyImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(false);

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

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={isInView ? src : undefined}
      alt={alt}
      className={className}
      onLoad={onLoad}
      {...rest}
    />
  );
}
