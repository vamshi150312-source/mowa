"use client";

import { useEffect, useRef, useState } from "react";
import { getTrack, MUSIC_CREDIT, TRACKS } from "@/lib/music";
import { CheckIcon, CloseIcon, MusicIcon, PlayIcon } from "./icons";

/** "Add music" row for the composers: pick a track from the library, with previews. */
export function MusicPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (trackId: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const selected = getTrack(value);

  // One preview at a time; stop it when the list closes or the picker goes away.
  useEffect(() => {
    if (!open) {
      audio.current?.pause();
      setPreviewing(null);
    }
  }, [open]);
  useEffect(() => () => audio.current?.pause(), []);

  function preview(id: string) {
    audio.current?.pause();
    if (previewing === id) return setPreviewing(null);
    const track = getTrack(id)!;
    audio.current = new Audio(track.url);
    audio.current.play().catch(() => setPreviewing(null));
    setPreviewing(id);
  }

  return (
    <section className="border-t border-neutral-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <MusicIcon className="h-5 w-5 text-neutral-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{selected ? selected.title : "Add music"}</p>
          <p className="truncate text-xs text-neutral-500">
            {selected ? `${selected.artist} · replaces the video's own sound` : "Give your video or story a soundtrack"}
          </p>
        </div>
        {selected && (
          <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label="Remove music" className="p-1 text-neutral-400 hover:text-neutral-700">
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled}
          aria-expanded={open}
          className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-200"
        >
          {open ? "Done" : selected ? "Change" : "Browse"}
        </button>
      </div>

      {open && (
        <>
          <ul className="mt-3 max-h-72 divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200">
            {TRACKS.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => preview(t.id)}
                  aria-label={previewing === t.id ? `Stop preview of ${t.title}` : `Preview ${t.title}`}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    previewing === t.id ? "bg-pink-500 text-white" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {previewing === t.id ? <span className="h-2.5 w-2.5 rounded-sm bg-white" /> : <PlayIcon className="ml-0.5 h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  aria-pressed={value === t.id}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.title}</span>
                    <span className="block text-xs text-neutral-500">{t.mood}</span>
                  </span>
                  {value === t.id && <CheckIcon className="h-4 w-4 text-pink-600" />}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-neutral-400">{MUSIC_CREDIT}</p>
        </>
      )}
    </section>
  );
}
