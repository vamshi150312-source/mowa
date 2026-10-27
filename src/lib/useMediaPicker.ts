"use client";

import { useEffect, useState } from "react";
import { getVideoDuration } from "./image";
import type { MediaType } from "./types";

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;

/**
 * A chosen photo or video plus a preview URL, with the app's size and length limits
 * checked. Used by the post and story composers.
 */
export function useMediaPicker() {
  const [media, setMedia] = useState<{ file: File; type: MediaType } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke the old preview URL whenever the file changes.
  useEffect(() => {
    if (!media) return setPreview(null);
    const url = URL.createObjectURL(media.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [media]);

  async function pick(selected: File | undefined) {
    setError(null);
    if (!selected) return;

    if (selected.type.startsWith("image/")) {
      if (selected.size > MAX_IMAGE_BYTES) return setError("That photo is over 20 MB.");
      return setMedia({ file: selected, type: "image" });
    }

    if (selected.type.startsWith("video/")) {
      if (selected.size > MAX_VIDEO_BYTES) return setError("That video is over 50 MB.");
      setChecking(true);
      try {
        const seconds = await getVideoDuration(selected);
        if (seconds > MAX_VIDEO_SECONDS + 0.5)
          return setError(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds (this one is ${Math.round(seconds)}s).`);
        setMedia({ file: selected, type: "video" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't read that video.");
      } finally {
        setChecking(false);
      }
      return;
    }

    setError("Please choose a photo or video.");
  }

  return { media, preview, checking, error, setError, pick };
}
