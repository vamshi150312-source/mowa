"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CallScreen } from "@/components/CallScreen";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { CallLink, playTone } from "@/lib/callLink";
import { setSoundOn } from "@/lib/sound";
import type { Call, CallKind, Profile } from "@/lib/types";

const INCOMING_POLL_MS = 2000;
/** How long the "Call ended" screen stays up. */
const ENDED_MS = 1800;

export type CallPhase = "outgoing" | "incoming" | "connecting" | "active" | "ended";

export type CallSession = {
  /** Null until the server has created the call. */
  call: Call | null;
  kind: CallKind;
  /** The other person. */
  peer: Profile;
  isCaller: boolean;
  phase: CallPhase;
  /** Why it ended or couldn't start, shown on the call screen. */
  notice: string | null;
  connectedAt: number | null;
};

export type CallMedia = {
  local: MediaStream | null;
  remote: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
};

type CallsContextValue = {
  startCall: (user: Profile, kind: CallKind) => void;
};

const CallsContext = createContext<CallsContextValue>({ startCall: () => {} });

/** Start calls from anywhere. The value never changes, so using it doesn't cause re-renders. */
export const useCalls = () => useContext(CallsContext);

const INSECURE =
  "Calls need a secure connection to use the camera and microphone. Open Mova on https (see the README), or at localhost on this computer.";

function endNotice(call: Call, isCaller: boolean): string {
  switch (call.endReason) {
    case "declined":
      return isCaller ? `${call.callee.username} declined` : "Call ended";
    case "missed":
      return isCaller ? "No answer" : "Missed call";
    case "busy":
      return `${call.callee.username} is busy`;
    default:
      return "Call ended";
  }
}

async function getMedia(kind: CallKind, facingMode: "user" | "environment" = "user"): Promise<MediaStream> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error(INSECURE);
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: kind === "video" ? { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  } catch (e) {
    const name = (e as DOMException).name;
    if (name === "NotAllowedError")
      throw new Error(`Allow ${kind === "video" ? "camera and microphone" : "microphone"} access to make calls.`);
    if (name === "NotFoundError") throw new Error(`No ${kind === "video" ? "camera or microphone" : "microphone"} found.`);
    throw new Error("Couldn't start your camera or microphone.");
  }
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const calls = api.calls;
  const [session, setSession] = useState<CallSession | null>(null);
  const [media, setMedia] = useState<CallMedia>({ local: null, remote: null, micOn: true, cameraOn: true });

  // Everything below is mutable call machinery, kept out of React state.
  const sessionRef = useRef<CallSession | null>(null);
  const link = useRef<CallLink | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const facing = useRef<"user" | "environment">("user");
  /** Bumped whenever a call ends, so async steps of an old call know to stop. */
  const generation = useRef(0);
  const endedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const update = useCallback((next: CallSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);
  const patch = useCallback(
    (changes: Partial<CallSession>) => sessionRef.current && update({ ...sessionRef.current, ...changes }),
    [update],
  );

  /** Tears down the media and connection and shows `notice` briefly (or closes at once). */
  const finish = useCallback(
    (notice: string | null) => {
      generation.current++;
      link.current?.stop();
      link.current = null;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setMedia({ local: null, remote: null, micOn: true, cameraOn: true });
      clearTimeout(endedTimer.current);
      if (!sessionRef.current) return;
      if (!notice) return update(null);
      patch({ phase: "ended", notice });
      endedTimer.current = setTimeout(() => update(null), ENDED_MS);
    },
    [patch, update],
  );

  /** Connects the WebRTC link for the current call. */
  const connect = useCallback(
    (call: Call, isCaller: boolean, local: MediaStream) => {
      const gen = generation.current;
      const current = new CallLink(calls, call.id, isCaller, local, {
        remote: (remote) => gen === generation.current && setMedia((m) => ({ ...m, remote })),
        connected: () => gen === generation.current && patch({ phase: "active", connectedAt: Date.now() }),
        failed: () => {
          if (gen !== generation.current) return;
          void calls.end(call.id).catch(() => {});
          finish("Connection lost");
        },
        status: (latest) => {
          if (gen !== generation.current) return;
          if (latest.status === "ended") finish(endNotice(latest, isCaller));
          else if (latest.status === "active" && sessionRef.current?.phase === "outgoing") patch({ phase: "connecting" });
        },
      });
      link.current = current;
      current.start().catch(() => {
        if (gen !== generation.current) return;
        void calls.end(call.id).catch(() => {});
        finish("Couldn't connect the call");
      });
    },
    [calls, finish, patch],
  );

  const startCall = useCallback(
    async (peer: Profile, kind: CallKind) => {
      if (sessionRef.current) return;
      clearTimeout(endedTimer.current);
      const gen = ++generation.current;
      facing.current = "user";
      setSoundOn(false); // quiet any videos playing behind the call
      update({ call: null, kind, peer, isCaller: true, phase: "outgoing", notice: null, connectedAt: null });
      let local: MediaStream;
      try {
        local = await getMedia(kind);
      } catch (e) {
        if (gen === generation.current) finish((e as Error).message);
        return;
      }
      if (gen !== generation.current) return local.getTracks().forEach((t) => t.stop());
      stream.current = local;
      setMedia({ local, remote: null, micOn: true, cameraOn: kind === "video" });
      let call: Call;
      try {
        call = await calls.start(peer.id, kind);
      } catch (e) {
        if (gen === generation.current) finish(e instanceof Error ? e.message : "Couldn't start the call.");
        return;
      }
      // Hung up while the call was being created.
      if (gen !== generation.current) return void calls.end(call.id).catch(() => {});
      patch({ call });
      connect(call, true, local);
    },
    [calls, connect, finish, patch, update],
  );

  const accept = useCallback(async () => {
    const current = sessionRef.current;
    if (!current?.call || current.phase !== "incoming") return;
    const { call } = current;
    const gen = generation.current;
    patch({ phase: "connecting" });
    let local: MediaStream;
    try {
      local = await getMedia(call.kind);
    } catch (e) {
      if (gen !== generation.current) return;
      void calls.end(call.id).catch(() => {});
      return finish((e as Error).message);
    }
    if (gen !== generation.current) return local.getTracks().forEach((t) => t.stop());
    stream.current = local;
    setMedia({ local, remote: null, micOn: true, cameraOn: call.kind === "video" });
    try {
      await calls.accept(call.id);
    } catch {
      if (gen === generation.current) finish("Call ended");
      return;
    }
    if (gen === generation.current) connect(call, false, local);
  }, [calls, connect, finish, patch]);

  /** Hang up, cancel or decline. */
  const hangUp = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.phase === "ended") return update(null);
    if (current.call) void calls.end(current.call.id).catch(() => {});
    // Declining just closes; hanging up shows "Call ended" for a moment.
    finish(current.phase === "incoming" ? null : "Call ended");
  }, [calls, finish, update]);

  const toggleMic = useCallback(() => {
    const track = stream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMedia((m) => ({ ...m, micOn: track.enabled }));
  }, []);

  const toggleCamera = useCallback(() => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMedia((m) => ({ ...m, cameraOn: track.enabled }));
  }, []);

  const flipCamera = useCallback(async () => {
    const local = stream.current;
    const old = local?.getVideoTracks()[0];
    if (!local || !old) return;
    const next = facing.current === "user" ? "environment" : "user";
    try {
      const fresh = (await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next } } })).getVideoTracks()[0];
      fresh.enabled = old.enabled;
      await link.current?.replaceVideoTrack(fresh);
      local.removeTrack(old);
      old.stop();
      local.addTrack(fresh);
      facing.current = next;
      // A new MediaStream object so the preview picks up the new track.
      const updated = new MediaStream(local.getTracks());
      stream.current = updated;
      setMedia((m) => ({ ...m, local: updated }));
    } catch {
      /* no other camera */
    }
  }, []);

  // Watch for incoming calls while signed in and idle.
  useEffect(() => {
    if (!user || session) return;
    let active = true;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      calls
        .incoming()
        .then((call) => {
          if (!active || !call || sessionRef.current) return;
          clearTimeout(endedTimer.current);
          generation.current++;
          update({ call, kind: call.kind, peer: call.caller, isCaller: false, phase: "incoming", notice: null, connectedAt: null });
        })
        .catch(() => {});
    };
    check();
    const timer = setInterval(check, INCOMING_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [calls, user, session, update]);

  // While it rings for you, notice if the caller gives up.
  const ringingId = session?.phase === "incoming" ? session.call?.id : undefined;
  useEffect(() => {
    if (!ringingId) return;
    const gen = generation.current;
    const timer = setInterval(() => {
      calls
        .poll(ringingId, Number.MAX_SAFE_INTEGER)
        .then(({ call }) => {
          if (gen === generation.current && sessionRef.current?.phase === "incoming" && call.status === "ended")
            finish("Missed call");
        })
        .catch(() => gen === generation.current && sessionRef.current?.phase === "incoming" && finish("Missed call"));
    }, 1500);
    return () => clearInterval(timer);
  }, [calls, ringingId, finish]);

  // Ringtones: incoming ring for the person called, ringback for the caller.
  const tone = session?.phase === "incoming" ? "ring" : session?.phase === "outgoing" && session.call ? "ringback" : null;
  useEffect(() => {
    if (!tone) return;
    if (tone === "ring") setSoundOn(false);
    return playTone(tone);
  }, [tone]);

  // Signed out mid-call, or leaving the page: hang up.
  useEffect(() => {
    if (!user && sessionRef.current) hangUp();
  }, [user, hangUp]);
  useEffect(() => () => finish(null), [finish]);

  const value = useMemo<CallsContextValue>(
    () => ({ startCall: (u, k) => void startCall(u, k) }),
    [startCall],
  );

  return (
    <CallsContext.Provider value={value}>
      {children}
      {session && (
        <CallScreen
          session={session}
          media={media}
          onAccept={accept}
          onHangUp={hangUp}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onFlipCamera={flipCamera}
        />
      )}
    </CallsContext.Provider>
  );
}
