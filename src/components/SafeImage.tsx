"use client";

/* eslint-disable @next/next/no-img-element -- remote user images of unknown origin */
import { useState, type ImgHTMLAttributes } from "react";

/** <img> that swaps to a deterministic placeholder if the original URL fails to load. */
export function SafeImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const [failed, setFailed] = useState(false);
  const fallback = `https://picsum.photos/seed/${encodeURIComponent(src.slice(-24))}/1080`;
  return (
    <img
      {...props}
      src={failed ? fallback : src}
      alt={alt}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
