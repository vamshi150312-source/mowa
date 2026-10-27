"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CallMedia, CallSession } from "@/context/CallContext";
import { formatDuration } from "@/lib/chat";
import { Avatar } from "./Avatar";
import { CameraOffIcon, FlipCameraIcon, HangUpIcon, MicIcon, MicOffIcon, PhoneIcon, VideoCallIcon } from "./icons";

/** Full-screen call UI: incoming (accept/decline), ringing, and the call itself. */
export function CallScreen({
  session,
  media,
  onAccept,
  onHangUp,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
}: {
  session: CallSession;
  media: CallMedia;
  onAccept: () => void;
  onHangUp: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
}) {
  const { peer, kind, phase } = session;
  const video = kind === "video";
  const showRemoteVideo = video && phase === "active" && !!media.remote;
  const [cameras, setCameras] = useState(0);

  useEffect(() => {
    if (!video || !media.local) return;
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => setCameras(devices.filter((d) => d.kind === "videoinput").length))
      .catch(() => {});
  }, [video, media.local]);

  const status =
    phase === "incoming"
      ? `Incoming ${video ? "video" : "audio"} call…`
      : phase === "outgoing"
        ? session.call
          ? "Ringing…"
          : "Calling…"
        : phase === "connecting"
          ? "Connecting…"
          : phase === "ended"
            ? session.notice
            : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${video ? "Video" : "Audio"} call with ${peer.username}`}
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-neutral-950 text-white"
    >
      {/* Their video fills the screen; before it arrives, your own camera does (dimmed). */}
      {showRemoteVideo && <Media stream={media.remote} className="absolute inset-0 h-full w-full object-cover" />}
      {!video && media.remote && <Media stream={media.remote} audioOnly />}
      {video && media.local && (
        <Media
          stream={media.local}
          muted
          className={
            showRemoteVideo
              ? "absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 aspect-[3/4] w-28 -scale-x-100 rounded-2xl border border-white/20 object-cover shadow-xl"
              : "absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-40"
          }
          hidden={!media.cameraOn}
        />
      )}
      {!video && (
        <div className="absolute inset-0 bg-gradient-to-b from-violet-900 via-neutral-950 to-neutral-950" aria-hidden />
      )}

      {showRemoteVideo ? (
        <div className="relative z-10 bg-gradient-to-b from-black/60 to-transparent px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <p className="font-semibold">{peer.fullName || peer.username}</p>
          {session.connectedAt && <CallTimer since={session.connectedAt} />}
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className={phase === "incoming" || phase === "outgoing" ? "animate-pulse" : ""}>
            <span className="inline-flex scale-150 rounded-full ring-4 ring-white/10">
              <Avatar user={peer} size="lg" />
            </span>
          </span>
          <p className="mt-8 text-2xl font-semibold">{peer.fullName || peer.username}</p>
          {phase === "active" && session.connectedAt ? (
            <CallTimer since={session.connectedAt} />
          ) : (
            <p className="max-w-xs text-sm text-white/70" aria-live="polite">
              {status}
            </p>
          )}
        </div>
      )}
      {showRemoteVideo && <div className="flex-1" />}

      <div className="relative z-10 flex items-center justify-center gap-5 bg-gradient-to-t from-black/60 to-transparent px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
        {phase === "incoming" ? (
          <>
            <RoundButton label="Decline" onClick={onHangUp} className="bg-red-500 hover:bg-red-600" big>
              <HangUpIcon className="h-8 w-8" />
            </RoundButton>
            <RoundButton label="Accept" onClick={onAccept} className="bg-green-500 hover:bg-green-600" big>
              {video ? <VideoCallIcon className="h-7 w-7" /> : <PhoneIcon className="h-7 w-7" />}
            </RoundButton>
          </>
        ) : phase === "ended" ? (
          <p className="h-16 text-sm text-white/60">{showRemoteVideo ? session.notice : ""}</p>
        ) : (
          <>
            {video && cameras > 1 && (
              <RoundButton label="Switch camera" onClick={onFlipCamera} className="bg-white/15 hover:bg-white/25">
                <FlipCameraIcon className="h-6 w-6" />
              </RoundButton>
            )}
            {video && (
              <RoundButton
                label={media.cameraOn ? "Turn camera off" : "Turn camera on"}
                pressed={!media.cameraOn}
                onClick={onToggleCamera}
                className={media.cameraOn ? "bg-white/15 hover:bg-white/25" : "bg-white text-neutral-900"}
              >
                {media.cameraOn ? <VideoCallIcon className="h-6 w-6" /> : <CameraOffIcon className="h-6 w-6" />}
              </RoundButton>
            )}
            <RoundButton
              label={media.micOn ? "Mute" : "Unmute"}
              pressed={!media.micOn}
              onClick={onToggleMic}
              className={media.micOn ? "bg-white/15 hover:bg-white/25" : "bg-white text-neutral-900"}
            >
              {media.micOn ? <MicIcon className="h-6 w-6" /> : <MicOffIcon className="h-6 w-6" />}
            </RoundButton>
            <RoundButton label="End call" onClick={onHangUp} className="bg-red-500 hover:bg-red-600">
              <HangUpIcon className="h-7 w-7" />
            </RoundButton>
          </>
        )}
      </div>
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  className,
  big,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  className: string;
  big?: boolean;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={`flex items-center justify-center rounded-full transition-transform active:scale-90 ${big ? "h-16 w-16" : "h-14 w-14"} ${className}`}
    >
      {children}
    </button>
  );
}

/** A <video> (or <audio>) showing a live MediaStream. */
function Media({
  stream,
  muted,
  audioOnly,
  className,
  hidden,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  audioOnly?: boolean;
  className?: string;
  hidden?: boolean;
}) {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);
  if (audioOnly) return <audio ref={ref} autoPlay />;
  return <video ref={ref} autoPlay playsInline muted={muted} className={`${className} ${hidden ? "invisible" : ""}`} />;
}

/** Counts up from when the call connected. Re-renders only itself each second. */
function CallTimer({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <p className="text-sm tabular-nums text-white/80">{formatDuration(Math.max(0, (now - since) / 1000))}</p>;
}
