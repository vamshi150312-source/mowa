"use client";

// The WebRTC side of a call: one peer connection, set up by exchanging an offer, an answer
// and network candidates through the backend's call signalling (polled), after which audio
// and video flow directly between the two devices.
import type { Call, CallSignal, CallSignaling } from "./types";

/**
 * Public STUN servers let two devices on different networks find a route to each other.
 * On the same Wi-Fi they connect directly. Some strict networks (many mobile carriers,
 * corporate firewalls) also need a TURN relay server, which isn't set up here.
 */
const ICE_SERVERS: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

/** Poll quickly while connecting; once connected, just often enough to notice a hang-up. */
const POLL_CONNECTING_MS = 600;
const POLL_CONNECTED_MS = 1500;

export type CallLinkEvents = {
  /** The other person's audio/video arrived. */
  remote: (stream: MediaStream) => void;
  /** Latest call state from the server, after each poll. */
  status: (call: Call) => void;
  connected: () => void;
  /** The connection broke and couldn't recover. */
  failed: () => void;
};

export class CallLink {
  private pc: RTCPeerConnection;
  private seq = 0;
  /** Candidates that arrived before the other side's offer/answer. */
  private queued: RTCIceCandidateInit[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private connected = false;

  constructor(
    private calls: CallSignaling,
    private callId: string,
    private isCaller: boolean,
    stream: MediaStream,
    private on: CallLinkEvents,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    for (const track of stream.getTracks()) this.pc.addTrack(track, stream);
    this.pc.ontrack = (e) => on.remote(e.streams[0] ?? new MediaStream([e.track]));
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.send("candidate", e.candidate.toJSON());
    };
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === "connected" && !this.connected) {
        this.connected = true;
        on.connected();
      }
      if (state === "failed") on.failed();
    };
  }

  /** The caller sends the offer; both sides then poll for the other's signals. */
  async start() {
    if (this.isCaller) {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await this.send("offer", { type: offer.type, sdp: offer.sdp });
    }
    void this.loop();
  }

  /** Swaps the camera being sent (switching between front and back). */
  async replaceVideoTrack(track: MediaStreamTrack) {
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
    await sender?.replaceTrack(track);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.pc.close();
  }

  private send(type: CallSignal["type"], data: unknown) {
    return this.calls.signal(this.callId, type, data).catch(() => {});
  }

  private async loop() {
    if (this.stopped) return;
    try {
      const { call, signals } = await this.calls.poll(this.callId, this.seq);
      if (this.stopped) return;
      for (const signal of signals) {
        this.seq = Math.max(this.seq, signal.seq);
        await this.handle(signal);
      }
      this.on.status(call);
      if (call.status === "ended") return;
    } catch {
      /* a network blip: try again on the next tick */
    }
    if (!this.stopped) this.timer = setTimeout(() => this.loop(), this.connected ? POLL_CONNECTED_MS : POLL_CONNECTING_MS);
  }

  private async handle(signal: CallSignal) {
    const pc = this.pc;
    try {
      if (signal.type === "offer" && !this.isCaller) {
        await pc.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
        await this.flush();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this.send("answer", { type: answer.type, sdp: answer.sdp });
      } else if (signal.type === "answer" && this.isCaller && !pc.remoteDescription) {
        await pc.setRemoteDescription(signal.data as RTCSessionDescriptionInit);
        await this.flush();
      } else if (signal.type === "candidate") {
        const candidate = signal.data as RTCIceCandidateInit;
        if (pc.remoteDescription) await pc.addIceCandidate(candidate);
        else this.queued.push(candidate);
      }
    } catch {
      /* a bad or late signal; the connection either still succeeds or fails and ends the call */
    }
  }

  private async flush() {
    for (const candidate of this.queued.splice(0)) await this.pc.addIceCandidate(candidate).catch(() => {});
  }
}

/**
 * Ringtones made with Web Audio, so there's no sound file to load. "ring" is the incoming
 * call (and vibrates on phones); "ringback" is what the caller hears while it rings.
 * Returns a function that stops it.
 */
export function playTone(kind: "ring" | "ringback"): () => void {
  let ctx: AudioContext | null = null;
  try {
    ctx = new AudioContext();
  } catch {
    return () => {};
  }
  const beep = (freqs: number[], start: number, length: number, volume: number) => {
    for (const freq of freqs) {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.02);
      gain.gain.setValueAtTime(volume, start + length - 0.05);
      gain.gain.linearRampToValueAtTime(0, start + length);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + length);
    }
  };
  const once = () => {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    if (kind === "ringback") beep([440, 480], t, 1.6, 0.05);
    else {
      // A rising three-note chime, twice.
      [0, 0.18, 0.36, 1, 1.18, 1.36].forEach((offset, i) => beep([[659, 784, 988][i % 3]], t + offset, 0.16, 0.12));
      navigator.vibrate?.([400, 200, 400]);
    }
  };
  // Browsers start audio suspended until the page has had a tap; try to resume anyway.
  void ctx.resume().catch(() => {});
  once();
  const timer = setInterval(once, kind === "ringback" ? 4000 : 3000);
  return () => {
    clearInterval(timer);
    navigator.vibrate?.(0);
    void ctx?.close().catch(() => {});
    ctx = null;
  };
}
