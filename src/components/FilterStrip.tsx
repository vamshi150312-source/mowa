"use client";

/* eslint-disable @next/next/no-img-element -- local object URL previews */
import { FILTERS, type FilterId } from "@/lib/postOptions";
import type { MediaType } from "@/lib/types";
import { WandIcon } from "./icons";

/** Row of filter thumbnails for the chosen photo or video. */
export function FilterStrip({
  preview,
  mediaType,
  value,
  onChange,
  disabled,
}: {
  preview: string;
  mediaType: MediaType;
  value: FilterId;
  onChange: (filter: FilterId) => void;
  disabled?: boolean;
}) {
  return (
    <section aria-label="Filters" className="border-b border-neutral-100 py-3">
      <h2 className="flex items-center gap-1.5 px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        <WandIcon className="h-3.5 w-3.5" /> Filters{mediaType === "video" && " · work on videos too"}
      </h2>
      <ul className="flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <li key={f.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onChange(f.id)}
              aria-pressed={value === f.id}
              disabled={disabled}
              className="flex flex-col items-center gap-1"
            >
              <span
                className={`block h-16 w-16 overflow-hidden rounded-lg ring-2 ring-offset-2 transition ${
                  value === f.id ? "ring-pink-500" : "ring-transparent"
                }`}
              >
                {mediaType === "video" ? (
                  <video
                    src={`${preview}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                    style={{ filter: f.css || undefined }}
                  />
                ) : (
                  <img src={preview} alt="" className="h-full w-full object-cover" style={{ filter: f.css || undefined }} />
                )}
              </span>
              <span className={`text-xs ${value === f.id ? "font-semibold" : "text-neutral-500"}`}>{f.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
