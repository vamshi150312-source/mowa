package dev.mova.service;

import dev.mova.domain.Dto;
import dev.mova.domain.Rows;
import dev.mova.domain.Times;
import dev.mova.web.ApiException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/**
 * Audio and video calls. The media goes directly between the two browsers (WebRTC); this
 * only passes along the setup messages ("signals") and the call's state. Calls are
 * short-lived, so they're kept in memory; how each one went is saved as a chat message.
 */
@Service
public class Calls {
  /** Unanswered calls stop ringing after this long. */
  private static final long RING_MS = 40_000;
  /** A call ends if either person's app stops checking in for this long (tab closed, offline). */
  private static final long STALE_MS = 15_000;
  /** Ended calls are kept briefly so both sides find out how it ended. */
  private static final long KEEP_ENDED_MS = 60_000;

  static final class CallState {
    final String id;
    final String callerId;
    final String calleeId;
    final String kind;
    String status = "ringing";
    String endReason;
    final long createdAt;
    Long answeredAt;
    Long endedAt;
    final List<Signal> signals = new ArrayList<>();
    final Map<String, Long> lastSeen = new HashMap<>();

    CallState(String id, String callerId, String calleeId, String kind, long now) {
      this.id = id;
      this.callerId = callerId;
      this.calleeId = calleeId;
      this.kind = kind;
      this.createdAt = now;
      lastSeen.put(callerId, now);
    }

    boolean involves(String userId) {
      return callerId.equals(userId) || calleeId.equals(userId);
    }

    void end(String reason, long now) {
      status = "ended";
      endReason = reason;
      endedAt = now;
    }
  }

  record Signal(int seq, String from, String type, Object data) {}

  private static final List<String> SIGNAL_TYPES = List.of("offer", "answer", "candidate");

  private final Map<String, CallState> calls = new ConcurrentHashMap<>();
  private final JdbcTemplate db;
  private final Views views;
  private final JsonMapper json;

  public Calls(JdbcTemplate db, Views views, JsonMapper json) {
    this.db = db;
    this.views = views;
    this.json = json;
  }

  private Dto.Call toCall(CallState call) {
    return new Dto.Call(
        call.id, call.kind, views.user(call.callerId).profile(), views.user(call.calleeId).profile(), call.status, call.endReason);
  }

  private CallState find(String id, String userId) {
    CallState call = calls.get(id);
    if (call == null || !call.involves(userId)) throw new ApiException(404, "This call has ended.");
    return call;
  }

  private CallState current(String userId) {
    return calls.values().stream().filter(c -> !c.status.equals("ended") && c.involves(userId)).findFirst().orElse(null);
  }

  /** Ends calls that rang out or that someone left without hanging up, records them, and forgets old ones. */
  private void sweep() {
    long now = System.currentTimeMillis();
    List<CallState> ended = new ArrayList<>();
    for (CallState call : calls.values()) {
      if (call.status.equals("ended")) {
        if (now - call.endedAt > KEEP_ENDED_MS) calls.remove(call.id);
        continue;
      }
      boolean callerQuiet = now - call.lastSeen.getOrDefault(call.callerId, call.createdAt) > STALE_MS;
      boolean calleeQuiet = now - call.lastSeen.getOrDefault(call.calleeId, call.createdAt) > STALE_MS;
      if (call.status.equals("ringing") && (now - call.createdAt > RING_MS || callerQuiet)) {
        call.end("missed", now);
        ended.add(call);
      } else if (call.status.equals("active") && (callerQuiet || calleeQuiet)) {
        call.end("completed", now);
        ended.add(call);
      }
    }
    ended.forEach(this::record);
  }

  /** Saves how a call went as a message in the chat, from the caller to the person called. */
  private void record(CallState call) {
    if (call.endReason.equals("busy")) return;
    boolean answered = call.answeredAt != null;
    String outcome = answered ? "completed" : call.endReason.equals("declined") ? "declined" : "missed";
    Instant ended = Instant.ofEpochMilli(call.endedAt);
    db.update(
        "insert into messages (id, from_id, to_id, body, created_at, read_at, call_kind, call_outcome, call_duration_sec) "
            + "select ?, ?, ?, '', ?, ?, ?, ?, ? "
            + "where exists (select 1 from users where id = ?) and exists (select 1 from users where id = ?) "
            + "on conflict (id) do nothing",
        "call-" + call.id,
        call.callerId,
        call.calleeId,
        Times.sql(Instant.ofEpochMilli(call.createdAt)),
        // A missed call stays unread for the person who missed it.
        answered || outcome.equals("declined") ? Times.sql(ended) : null,
        call.kind,
        outcome,
        answered ? (int) Math.round((call.endedAt - call.answeredAt) / 1000.0) : 0,
        call.callerId,
        call.calleeId);
  }

  public synchronized Dto.Call start(Rows.User me, String userId, String kind) {
    Rows.User other = views.user(userId);
    if (other.id().equals(me.id())) throw new ApiException(400, "You can't call yourself.");
    sweep();
    if (current(me.id()) != null) throw new ApiException(409, "You're already in a call.");
    if (current(other.id()) != null) throw new ApiException(409, other.username() + " is on another call.");
    CallState call = new CallState(Simulation.newId(), me.id(), other.id(), kind, System.currentTimeMillis());
    calls.put(call.id, call);
    return toCall(call);
  }

  public synchronized Dto.Call incoming(Rows.User me) {
    sweep();
    return calls.values().stream()
        .filter(c -> c.status.equals("ringing") && c.calleeId.equals(me.id()))
        .findFirst()
        .map(this::toCall)
        .orElse(null);
  }

  public synchronized Map<String, Object> poll(Rows.User me, String callId, int after) {
    CallState call = find(callId, me.id());
    call.lastSeen.put(me.id(), System.currentTimeMillis());
    sweep();
    List<Dto.CallSignal> signals = call.signals.stream()
        .filter(s -> !s.from().equals(me.id()) && s.seq() > after)
        .map(s -> new Dto.CallSignal(s.seq(), s.type(), s.data()))
        .toList();
    return Map.of("call", toCall(call), "signals", signals);
  }

  public synchronized void accept(Rows.User me, String callId) {
    CallState call = find(callId, me.id());
    if (!call.calleeId.equals(me.id())) throw new ApiException(403, "Only the person being called can answer.");
    if (!call.status.equals("ringing")) throw new ApiException(409, "This call has ended.");
    long now = System.currentTimeMillis();
    call.status = "active";
    call.answeredAt = now;
    call.lastSeen.put(me.id(), now);
  }

  public synchronized void end(Rows.User me, String callId) {
    CallState call = find(callId, me.id());
    if (call.status.equals("ended")) return;
    call.end(call.status.equals("active") ? "completed" : me.id().equals(call.calleeId) ? "declined" : "missed", System.currentTimeMillis());
    record(call);
  }

  public synchronized void signal(Rows.User me, String callId, Object type, Object data) {
    CallState call = find(callId, me.id());
    if (call.status.equals("ended")) throw new ApiException(409, "This call has ended.");
    if (!(type instanceof String t) || !SIGNAL_TYPES.contains(t)) throw new ApiException(400, "Unknown signal.");
    if (json.writeValueAsString(data).length() > 20_000) throw new ApiException(400, "Signal is too large.");
    if (call.signals.size() >= 500) throw new ApiException(429, "Too many signals for one call.");
    call.lastSeen.put(me.id(), System.currentTimeMillis());
    call.signals.add(new Signal(call.signals.size() + 1, me.id(), t, data));
  }
}
