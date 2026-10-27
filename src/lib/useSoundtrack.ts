"use client";

import { useEffect, useRef } from "react";
import { getTrack } from "./music";
import { setSoundOn } from "./sound";

/**
 * Plays a post's or story's music while `playing` is true, muted unless `soundOn`.
 * `restartKey` changing (e.g. a reel scrolled back into view) starts the track over.
 */
export function useSoundtrack(trackId: string | null, playing: boolean, soundOn: boolean, restartKey?: unknown) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // One <audio> per track; released when the track changes or the component goes away.
  useEffect(() => {
    const track = getTrack(trackId);
    if (!track) return;
    const audio = new Audio();
    audio.src = track.url;
    audio.loop = true;
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [trackId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
  }, [restartKey, trackId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !soundOn;
    if (!playing) return void audio.pause();
    audio.play().catch(() => {
      // Browsers block sound until the page has been tapped; fall back to muted.
      if (!soundOn) return;
      setSoundOn(false);
      audio.muted = true;
      audio.play().catch(() => {});
    });
  }, [playing, soundOn, trackId]);
}
