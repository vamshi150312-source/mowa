"use client";

import { useEffect, useRef, useState } from "react";
import { useSoundtrack } from "@/lib/useSoundtrack";

/**
 * Feed video: plays while at least 60% visible, pauses otherwise, loops silently unless
 * sound is on. With `music`, the soundtrack plays instead of the video's own sound.
 */
export function PostVideo({
  src,
  soundOn,
  label,
  music = null,
}: {
  src: string;
  soundOn: boolean;
  label: string;
  music?: string | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  useSoundtrack(music, visible, soundOn);

  // React doesn't reliably sync the `muted` attribute, so set the property directly.
  useEffect(() => {
    if (ref.current) ref.current.muted = music ? true : !soundOn;
  }, [soundOn, music]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const inView = entry.intersectionRatio >= 0.6;
        setVisible(inView);
        if (inView) {
          video.play().catch(() => {
            // Browsers block autoplay with sound until the user interacts; retry muted.
            video.muted = true;
            video.play().catch(() => {});
          });
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6] },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      aria-label={label}
      muted
      loop
      playsInline
      preload="metadata"
      className="h-full w-full object-cover"
    />
  );
}
