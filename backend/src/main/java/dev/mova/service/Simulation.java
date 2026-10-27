package dev.mova.service;

import dev.mova.domain.Options;
import dev.mova.domain.Rand;
import dev.mova.domain.Rows;
import dev.mova.domain.Times;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.DoubleSupplier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Keeps the sample accounts feeling alive. Generated activity only ever comes from sample
 * accounts and only lands on sample accounts' posts (including the demo account's), never
 * on accounts people sign up with. Sample accounts do answer anyone who messages them.
 */
@Service
public class Simulation {
  private static final long HOUR_MS = 3_600_000;

  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  private final Samples samples;
  private final MediaStore media;

  public Simulation(JdbcTemplate db, TransactionTemplate tx, Samples samples, MediaStore media) {
    this.db = db;
    this.tx = tx;
    this.samples = samples;
    this.media = media;
  }

  private Instant state(String key) {
    List<String> values = db.queryForList("select value from app_state where key = ?", String.class, key);
    return values.isEmpty() ? null : Times.parse(values.get(0));
  }

  private void setState(String key, Instant value) {
    db.update(
        "insert into app_state (key, value) values (?, ?) on conflict (key) do update set value = excluded.value",
        key,
        Times.iso(value));
  }

  /** Sample accounts that still exist. */
  private List<String> sampleUserIds() {
    return db.queryForList("select id from users", String.class).stream().filter(samples::isSample).toList();
  }

  // ---------------------------------------------------------------------------
  // Reactions, comments and the odd message from sample accounts
  // ---------------------------------------------------------------------------

  /**
   * Since the last run, sample accounts react to and comment on each other's recent posts
   * at about 1.5 actions a minute (at most 25 per call), and now and then message the
   * demo account. Runs at most once a minute.
   */
  public synchronized void activity() {
    tx.executeWithoutResult(status -> {
      Instant now = Times.now();
      Instant last = state("activityAt");
      if (last == null) last = now.minus(Duration.ofMinutes(5));
      double minutes = (now.toEpochMilli() - last.toEpochMilli()) / 60_000.0;
      if (minutes < 1) return;
      setState("activityAt", now);

      List<String> sampleIds = sampleUserIds();
      List<String> actors = sampleIds.stream().filter(id -> !id.equals(Samples.DEMO_ID)).toList();
      record Target(String postId, String userId, double weight) {}
      List<Target> targets = new ArrayList<>();
      db.query(
          "select id, user_id, created_at from posts where created_at <= ? and user_id = any(?)",
          rs -> {
            double ageMs = now.toEpochMilli() - Times.get(rs, "created_at").toEpochMilli();
            // Newer posts are much more likely to get attention (half-life of three days).
            targets.add(new Target(rs.getString("id"), rs.getString("user_id"), Math.pow(0.5, ageMs / (72.0 * HOUR_MS)) + 0.02));
          },
          Times.sql(now),
          sampleIds.toArray(String[]::new));
      double total = targets.stream().mapToDouble(Target::weight).sum();
      if (actors.isEmpty() || total == 0) return;

      DoubleSupplier rand = () -> ThreadLocalRandom.current().nextDouble();
      int events = (int) Math.min(25, Math.max(1, Math.round(minutes * 1.5)));
      for (int i = 0; i < events; i++) {
        double roll = rand.getAsDouble() * total;
        Target target = targets.get(targets.size() - 1);
        for (Target t : targets) {
          if ((roll -= t.weight()) <= 0) {
            target = t;
            break;
          }
        }
        String userId = actors.get(Rand.index(rand, actors.size()));
        if (userId.equals(target.userId())) continue;
        if (rand.getAsDouble() < 0.7) {
          db.update(
              "insert into reactions (post_id, user_id, reaction) values (?, ?, ?) "
                  + "on conflict (post_id, user_id) do update set reaction = excluded.reaction",
              target.postId(),
              userId,
              Samples.randomReaction(rand));
        } else {
          // Spread new comments over the time that passed.
          Instant at = now.minusMillis((long) (rand.getAsDouble() * Math.min(minutes, 60) * 60_000));
          db.update(
              "insert into comments (id, post_id, user_id, body, created_at) values (?, ?, ?, ?, ?)",
              "c-live-" + now.toEpochMilli() + "-" + i,
              target.postId(),
              userId,
              samples.randomComment(rand),
              Times.sql(at));
        }
      }

      // About every 40 minutes, a sample account messages the demo account.
      if (sampleIds.contains(Samples.DEMO_ID) && rand.getAsDouble() < Math.min(1, minutes / 40)) {
        List<String> openers = samples.data().chatOpeners();
        db.update(
            "insert into messages (id, from_id, to_id, body, created_at) values (?, ?, ?, ?, ?)",
            "m-live-" + now.toEpochMilli(),
            actors.get(Rand.index(rand, actors.size())),
            Samples.DEMO_ID,
            openers.get(Rand.index(rand, openers.size())),
            Times.sql(now));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Replies in chats
  // ---------------------------------------------------------------------------

  /** When a sample account sees and answers your latest message in a chat. */
  public record ReplyTiming(Rows.Message last, Instant seenAt, Instant replyAt) {}

  /**
   * Null if no response is due: the other person isn't a sample account (or is the demo
   * account), your latest message was already answered, it's a call record, or it's more
   * than 6 hours old.
   */
  public ReplyTiming replyTiming(String meId, String otherId, Instant now) {
    if (otherId.equals(Samples.DEMO_ID) || !samples.isSample(otherId)) return null;
    List<Rows.Message> rows = db.query(
        "select " + Rows.MESSAGE_COLUMNS + " from messages "
            + "where (from_id = ? and to_id = ?) or (from_id = ? and to_id = ?) order by created_at desc limit 1",
        Rows.MESSAGE,
        meId,
        otherId,
        otherId,
        meId);
    if (rows.isEmpty()) return null;
    Rows.Message last = rows.get(0);
    if (!last.fromId().equals(meId) || last.callKind() != null) return null;
    long sent = last.createdAt().toEpochMilli();
    if (now.toEpochMilli() - sent > 6 * HOUR_MS) return null;
    double delay = 4000 + Rand.hash(last.id()) * 6000;
    return new ReplyTiming(last, Instant.ofEpochMilli(sent + (long) (delay * 0.35)), Instant.ofEpochMilli(sent + (long) delay));
  }

  public boolean isTyping(String meId, String otherId) {
    Instant now = Instant.now();
    ReplyTiming t = replyTiming(meId, otherId, now);
    return t != null && !now.isBefore(t.seenAt()) && now.isBefore(t.replyAt());
  }

  /** True if {@link #replies} has something to do for this chat. */
  public boolean replyDue(String meId, String otherId) {
    Instant now = Instant.now();
    ReplyTiming t = replyTiming(meId, otherId, now);
    if (t == null) return false;
    if (!now.isBefore(t.replyAt())) return true;
    return !now.isBefore(t.seenAt())
        && db.queryForObject(
            "select exists (select 1 from messages where from_id = ? and to_id = ? and read_at is null)", Boolean.class, meId, otherId);
  }

  /** A sample account reads your messages, sometimes reacts to the last one, and replies. */
  public synchronized void replies(String meId, String otherId) {
    tx.executeWithoutResult(status -> {
      Instant now = Instant.now();
      ReplyTiming t = replyTiming(meId, otherId, now);
      if (t == null || now.isBefore(t.seenAt())) return;
      db.update(
          "update messages set read_at = ? where from_id = ? and to_id = ? and read_at is null",
          Times.sql(t.seenAt()),
          meId,
          otherId);
      if (now.isBefore(t.replyAt())) return;
      Rows.Message last = t.last();
      double roll = Rand.hash(last.id() + "reply");
      if (roll < 0.3) {
        String reaction = roll < 0.15 ? "❤️" : last.postId() != null ? "😂" : "👏";
        db.update("update messages set reaction = ? where id = ?", reaction, last.id());
      }
      db.update(
          "insert into messages (id, from_id, to_id, body, created_at) values (?, ?, ?, ?, ?) on conflict (id) do nothing",
          "m-reply-" + last.id(),
          otherId,
          meId,
          samples.chatReply(last.body(), last.postId() != null, Rand.hash(last.id() + "text")),
          Times.sql(t.replyAt()));
    });
  }

  /** Lets sample accounts answer any of my chats that are waiting on them. */
  public void pendingReplies(String meId) {
    List<String> partners = db.queryForList("select distinct to_id from messages where from_id = ?", String.class, meId);
    for (String other : partners) if (replyDue(meId, other)) replies(meId, other);
  }

  // ---------------------------------------------------------------------------
  // Stories
  // ---------------------------------------------------------------------------

  /**
   * Before reading stories: removes expired ones (and their uploaded files), and gives the
   * sample accounts a fresh set once a day so the stories bar always has something in it.
   */
  public synchronized void freshStories() {
    List<String> files = tx.execute(status -> {
      Instant now = Times.now();
      List<String> expired = db.queryForList("delete from stories where expires_at <= ? returning media_url", String.class, Times.sql(now));
      Instant lastSamples = state("sampleStoriesAt");
      if (lastSamples == null || Duration.between(lastSamples, now).toHours() >= Options.STORY_HOURS) {
        addSampleStories(now);
        setState("sampleStoriesAt", now);
      }
      return expired;
    });
    if (files != null) files.forEach(media::delete);
  }

  /** Each sample account's stories, a few minutes apart, ending 1-18 hours ago (so they expire at different times). */
  private void addSampleStories(Instant now) {
    List<String> users = sampleUserIds();
    DoubleSupplier rand = Rand.seeded((int) (now.toEpochMilli() / HOUR_MS));
    Map<String, List<Samples.Story>> byUser = new LinkedHashMap<>();
    for (Samples.Story s : samples.data().stories()) byUser.computeIfAbsent(s.userKey(), k -> new ArrayList<>()).add(s);
    for (var entry : byUser.entrySet()) {
      String userId = "u-" + entry.getKey();
      if (!users.contains(userId)) continue;
      List<Samples.Story> stories = entry.getValue();
      double endHoursAgo = 1 + rand.getAsDouble() * 17;
      for (int i = 0; i < stories.size(); i++) {
        Samples.Story story = stories.get(i);
        long created = now.toEpochMilli() - (long) ((endHoursAgo + (stories.size() - 1 - i) * 0.4) * HOUR_MS);
        db.update(
            "insert into stories (id, user_id, media_type, media_url, filter, music, caption, created_at, expires_at) "
                + "values (?, ?, ?, ?, 'none', ?, ?, ?, ?)",
            "s-" + entry.getKey() + "-" + now.toEpochMilli() + "-" + i,
            userId,
            story.mediaType(),
            story.url(),
            story.music(),
            story.caption(),
            Times.sql(Instant.ofEpochMilli(created)),
            Times.sql(Instant.ofEpochMilli(created + Options.STORY_HOURS * HOUR_MS)));
      }
    }
  }

  /** A UUID for new rows. */
  public static String newId() {
    return UUID.randomUUID().toString();
  }
}
