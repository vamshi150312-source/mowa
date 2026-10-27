"use client";

/* eslint-disable @next/next/no-img-element -- local object URL preview */
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { prepareStoryImage } from "@/lib/image";
import { filterCss, STORY_HOURS, STORY_MAX_CAPTION, type FilterId } from "@/lib/postOptions";
import { MAX_VIDEO_SECONDS, useMediaPicker } from "@/lib/useMediaPicker";
import { CreateModeSwitch } from "./CreateModeSwitch";
import { FilterStrip } from "./FilterStrip";
import { MusicPicker } from "./MusicPicker";
import { ImageIcon } from "./icons";
import { PageHeader } from "./PageHeader";
import { Spinner } from "./Spinner";

/** Create a story: a photo or video with optional text, gone after 24 hours. */
export function StoryComposer() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { media, preview, checking, error, setError, pick } = useMediaPicker();
  const [filter, setFilter] = useState<FilterId>("none");
  const [music, setMusic] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sharing, setSharing] = useState(false);

  async function share() {
    if (!media) return;
    setSharing(true);
    setError(null);
    try {
      // Photos are scaled to fit 1080×1920 (never cropped); videos upload as-is.
      const blob = media.type === "image" ? await prepareStoryImage(media.file) : media.file;
      await api.createStory({ media: blob, mediaType: media.type, filter, music, caption: caption.trim() });
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't share your story.");
      setSharing(false);
    }
  }

  return (
    <main className="pb-6">
      <PageHeader
        title={<CreateModeSwitch mode="story" />}
        back
        action={
          <button
            type="button"
            onClick={share}
            disabled={!media || sharing}
            className="text-sm font-semibold text-sky-500 disabled:opacity-40"
          >
            Share
          </button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="flex justify-center bg-neutral-100 px-6 py-4">
        <div
          className="relative aspect-[9/16] w-full max-w-[17rem] overflow-hidden rounded-2xl bg-neutral-900 text-white shadow-md"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
        >
          {preview && media ? (
            <>
              {media.type === "image" && (
                <img src={preview} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl" />
              )}
              <div className="absolute inset-0" style={{ filter: filterCss(filter) }}>
                {media.type === "video" ? (
                  <video src={preview} aria-label="Story video preview" autoPlay muted loop playsInline className="h-full w-full object-contain" />
                ) : (
                  <img src={preview} alt="Story photo preview" className="h-full w-full object-contain" />
                )}
              </div>
              {caption.trim() && (
                <p className="absolute inset-x-4 bottom-10 text-center">
                  <span className="box-decoration-clone rounded-md bg-black/50 px-2 py-1 text-sm font-semibold leading-7">
                    {caption}
                  </span>
                </p>
              )}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={sharing}
                className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold"
              >
                Change
              </button>
              {sharing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
                  <Spinner light />
                  <span className="text-sm font-semibold">Sharing…</span>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={checking}
              className="flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center"
            >
              {checking ? <Spinner light /> : <ImageIcon className="h-14 w-14 text-white/80" />}
              <span className="text-sm text-white/80">Add a photo or video to your story</span>
              <span className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-neutral-900">Select from device</span>
            </button>
          )}
        </div>
      </div>

      {preview && media && (
        <FilterStrip preview={preview} mediaType={media.type} value={filter} onChange={setFilter} disabled={sharing} />
      )}
      {media && <MusicPicker value={music} onChange={setMusic} disabled={sharing} />}

      <div className="p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Text on your story</span>
          <input
            value={caption}
            maxLength={STORY_MAX_CAPTION}
            disabled={sharing}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Say something…"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </label>
        <p className="mt-1 text-right text-xs text-neutral-400">
          {caption.length}/{STORY_MAX_CAPTION}
        </p>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
          ⏳ Your story disappears after {STORY_HOURS} hours. You&apos;ll see who viewed it and how they reacted. Videos can
          be up to {MAX_VIDEO_SECONDS} seconds.
        </p>
      </div>
    </main>
  );
}
