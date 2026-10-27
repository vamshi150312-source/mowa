"use client";

/* eslint-disable @next/next/no-img-element -- local object URL preview */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type ReactNode } from "react";
import { CreateModeSwitch } from "@/components/CreateModeSwitch";
import { FilterStrip } from "@/components/FilterStrip";
import { MusicPicker } from "@/components/MusicPicker";
import { ClockIcon, CloseIcon, ImageIcon, PollIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { StoryComposer } from "@/components/StoryComposer";
import { Spinner } from "@/components/Spinner";
import { Switch } from "@/components/Switch";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { prepareImage } from "@/lib/image";
import {
  filterCss,
  MAX_SCHEDULE_DAYS,
  POLL_MAX_OPTION,
  POLL_MAX_OPTIONS,
  POLL_MAX_QUESTION,
  POLL_MIN_OPTIONS,
  validatePoll,
  validatePublishAt,
  type FilterId,
} from "@/lib/postOptions";
import { MAX_VIDEO_SECONDS, useMediaPicker } from "@/lib/useMediaPicker";

const MAX_CAPTION = 2200;

/** Date as the value of an <input type="datetime-local">, in local time. */
function toLocalInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function CreatePage() {
  return (
    <Suspense>
      <Create />
    </Suspense>
  );
}

/** /create makes a post; /create?mode=story makes a story. The header switches between them. */
function Create() {
  const mode = useSearchParams().get("mode") === "story" ? "story" : "post";
  return mode === "story" ? <StoryComposer /> : <PostComposer />;
}

function PostComposer() {
  const router = useRouter();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const { media, preview, checking, error, setError, pick } = useMediaPicker();
  const [filter, setFilter] = useState<FilterId>("none");
  const [music, setMusic] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [pollOn, setPollOn] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [scheduleOn, setScheduleOn] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [sharing, setSharing] = useState(false);

  function toggleSchedule() {
    if (!scheduleOn && !publishAt) {
      // Default to tomorrow at 9:00.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setPublishAt(toLocalInput(tomorrow));
    }
    setScheduleOn(!scheduleOn);
  }

  async function share() {
    if (!media) return;
    const poll = pollOn ? { question: question.trim(), options: options.map((o) => o.trim()) } : null;
    const invalidPoll = poll && validatePoll(poll);
    if (invalidPoll) return setError(invalidPoll);
    // datetime-local values have no time zone; new Date() reads them as local time.
    const publishIso = scheduleOn && publishAt ? new Date(publishAt).toISOString() : null;
    if (scheduleOn && !publishIso) return setError("Pick a date and time to post.");
    const invalidTime = publishIso && validatePublishAt(publishIso);
    if (invalidTime) return setError(invalidTime);

    setSharing(true);
    setError(null);
    try {
      // Photos are cropped and compressed; videos upload as-is (already size/length limited).
      const blob = media.type === "image" ? await prepareImage(media.file) : media.file;
      await api.createPost({
        media: blob,
        mediaType: media.type,
        caption: caption.trim(),
        filter,
        // Music is for videos; photos in the feed don't play sound.
        music: media.type === "video" ? music : null,
        poll,
        publishAt: publishIso,
      });
      // A scheduled post isn't in the feed yet, so show it on the profile instead.
      router.push(publishIso && user ? `/u/${user.username}` : "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setSharing(false);
    }
  }

  const now = new Date();
  const maxDate = new Date(now.getTime() + MAX_SCHEDULE_DAYS * 86_400_000);

  return (
    <main>
      <PageHeader
        title={<CreateModeSwitch mode="post" />}
        back
        action={
          <button
            type="button"
            onClick={share}
            disabled={!media || sharing}
            className="text-sm font-semibold text-sky-500 disabled:opacity-40"
          >
            {scheduleOn ? "Schedule" : "Share"}
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
          e.target.value = ""; // allow re-picking the same file after an error
        }}
      />

      <div
        className="relative aspect-square w-full overflow-hidden bg-neutral-100"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
      >
        {preview && media ? (
          <>
            <div className="h-full w-full" style={{ filter: filterCss(filter) }}>
              {media.type === "video" ? (
                <video
                  src={preview}
                  aria-label="Selected video preview"
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="h-full w-full bg-black object-cover"
                />
              ) : (
                <img src={preview} alt="Selected photo preview" className="h-full w-full object-cover" />
              )}
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={sharing}
              className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Change
            </button>
            {sharing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70">
                <Spinner />
                <span className="text-sm font-semibold">{scheduleOn ? "Scheduling…" : "Sharing…"}</span>
              </div>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={checking}
            className="flex h-full w-full flex-col items-center justify-center gap-4 text-neutral-500"
          >
            {checking ? <Spinner /> : <ImageIcon className="h-20 w-20" />}
            <span className="text-lg">Drag photos and videos here</span>
            <span className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white">
              Select from device
            </span>
          </button>
        )}
      </div>

      {preview && media && (
        <FilterStrip preview={preview} mediaType={media.type} value={filter} onChange={setFilter} disabled={sharing} />
      )}
      {media?.type === "video" && <MusicPicker value={music} onChange={setMusic} disabled={sharing} />}

      <div className="p-4">
        <label htmlFor="caption" className="sr-only">
          Caption
        </label>
        <textarea
          id="caption"
          rows={3}
          value={caption}
          maxLength={MAX_CAPTION}
          disabled={sharing}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption…"
          className="w-full resize-none text-sm outline-none placeholder:text-neutral-400"
        />
        <p className="text-right text-xs text-neutral-400">
          {caption.length.toLocaleString()}/{MAX_CAPTION.toLocaleString()}
        </p>
      </div>

      <Extra
        icon={<PollIcon className="h-5 w-5" />}
        title="Add a poll"
        hint="Ask your followers a question right on the post"
        on={pollOn}
        onToggle={() => setPollOn(!pollOn)}
        disabled={sharing}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={POLL_MAX_QUESTION}
          placeholder="Ask a question…"
          aria-label="Poll question"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold outline-none focus:border-neutral-500"
        />
        <ol className="mt-2 space-y-2">
          {options.map((option, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={option}
                onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                maxLength={POLL_MAX_OPTION}
                placeholder={`Option ${i + 1}`}
                aria-label={`Option ${i + 1}`}
                className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
              {options.length > POLL_MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  aria-label={`Remove option ${i + 1}`}
                  className="p-1 text-neutral-400 hover:text-neutral-700"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ol>
        {options.length < POLL_MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => setOptions([...options, ""])}
            className="mt-2 text-sm font-semibold text-sky-500"
          >
            + Add option
          </button>
        )}
      </Extra>

      <Extra
        icon={<ClockIcon className="h-5 w-5" />}
        title="Schedule for later"
        hint={`Pick when it goes live, up to ${MAX_SCHEDULE_DAYS} days ahead`}
        on={scheduleOn}
        onToggle={toggleSchedule}
        disabled={sharing}
      >
        <input
          type="datetime-local"
          value={publishAt}
          min={toLocalInput(now)}
          max={toLocalInput(maxDate)}
          onChange={(e) => setPublishAt(e.target.value)}
          aria-label="Publish date and time"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        {publishAt && !Number.isNaN(new Date(publishAt).getTime()) && (
          <p className="mt-2 text-xs text-neutral-500">
            Goes live {formatDateTime(new Date(publishAt).toISOString())}. Until then only you can see it, on your
            profile.
          </p>
        )}
      </Extra>

      <div className="px-4 pb-6 pt-3">
        {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
        <p className="text-xs text-neutral-400">
          Photos are cropped to a square and resized to 1080px. Videos can be up to {MAX_VIDEO_SECONDS} seconds and 50
          MB, and also show in Reels (vertical videos look best). Filters never change your original file.
        </p>
      </div>
    </main>
  );
}

/** A switch row that reveals extra options when turned on. */
function Extra({
  icon,
  title,
  hint,
  on,
  onToggle,
  disabled,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-neutral-100 px-4 py-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        disabled={disabled}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="text-neutral-700">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-xs text-neutral-500">{hint}</span>
        </span>
        <Switch on={on} />
      </button>
      {on && <div className="mt-3">{children}</div>}
    </section>
  );
}
