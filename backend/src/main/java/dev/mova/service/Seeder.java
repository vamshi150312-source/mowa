package dev.mova.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import dev.mova.domain.Rand;
import dev.mova.domain.Rows;
import dev.mova.domain.Times;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.DoubleSupplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Fills an empty database on startup: imports data/db.json from the old Node backend if
 * it's there (accounts, passwords, posts, chats... everything), otherwise creates the
 * sample accounts and content.
 */
@Component
public class Seeder implements ApplicationRunner {
  private static final Logger log = LoggerFactory.getLogger(Seeder.class);

  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  private final JsonMapper json;
  private final Samples samples;
  private final Views views;
  private final Path oldDatabase;

  public Seeder(
      JdbcTemplate db, TransactionTemplate tx, JsonMapper json, Samples samples, Views views, @Value("${mova.data-dir}") String dataDir) {
    this.db = db;
    this.tx = tx;
    this.json = json;
    this.samples = samples;
    this.views = views;
    this.oldDatabase = Path.of(dataDir).toAbsolutePath().normalize().resolve("db.json");
  }

  @Override
  public void run(ApplicationArguments args) throws Exception {
    if (db.queryForObject("select count(*) from users", Integer.class) > 0) return;
    if (Files.isRegularFile(oldDatabase)) {
      OldDb old = json.readValue(oldDatabase.toFile(), OldDb.class);
      tx.executeWithoutResult(s -> importOld(old));
      log.info("Imported {} users, {} posts and {} messages from {}", old.users().size(), old.posts().size(), old.messages().size(), oldDatabase);
    } else {
      tx.executeWithoutResult(s -> seed());
      log.info("Created the sample accounts and content");
    }
  }

  // ---------------------------------------------------------------------------
  // Import from the old Node backend's data/db.json
  // ---------------------------------------------------------------------------

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldUser(String id, String email, String passwordHash, String username, String fullName, String bio, String avatarUrl, String createdAt) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldPost(
      String id, String userId, String mediaType, String imageUrl, String filter, String music, String caption, Rows.NewPoll poll, String createdAt) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldComment(String id, String postId, String userId, String body, String createdAt) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldLike(String postId, String userId, String reaction) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldVote(String postId, String userId, int option) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldFollow(String followerId, String followingId) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldSession(String token, String userId, String createdAt) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldStory(
      String id, String userId, String mediaType, String mediaUrl, String filter, String music, String caption, String createdAt, String expiresAt) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldStoryView(String storyId, String userId, String viewedAt, String reaction) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldCall(String kind, String outcome, int durationSec) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldMessage(
      String id, String fromId, String toId, String body, String postId, String createdAt, String readAt, String reaction, OldCall call) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  record OldDb(
      List<OldUser> users,
      List<OldPost> posts,
      List<OldComment> comments,
      List<OldLike> likes,
      List<OldVote> pollVotes,
      List<OldFollow> follows,
      List<OldSession> sessions,
      List<OldStory> stories,
      List<OldStoryView> storyViews,
      List<OldMessage> messages,
      String sampleStoriesAt,
      String activityAt) {
    OldDb {
      users = Objects.requireNonNullElse(users, List.of());
      posts = Objects.requireNonNullElse(posts, List.of());
      comments = Objects.requireNonNullElse(comments, List.of());
      likes = Objects.requireNonNullElse(likes, List.of());
      pollVotes = Objects.requireNonNullElse(pollVotes, List.of());
      follows = Objects.requireNonNullElse(follows, List.of());
      sessions = Objects.requireNonNullElse(sessions, List.of());
      stories = Objects.requireNonNullElse(stories, List.of());
      storyViews = Objects.requireNonNullElse(storyViews, List.of());
      messages = Objects.requireNonNullElse(messages, List.of());
    }
  }

  private static Object time(String iso) {
    Instant parsed = Times.parse(iso);
    return Times.sql(parsed == null ? Times.now() : parsed);
  }

  private static String orEmpty(String s) {
    return s == null ? "" : s;
  }

  private void importOld(OldDb old) {
    Set<String> users = new HashSet<>();
    List<Object[]> rows = new ArrayList<>();
    for (OldUser u : old.users()) {
      if (!users.add(u.id())) continue;
      rows.add(new Object[] {u.id(), u.email(), u.passwordHash(), u.username(), orEmpty(u.fullName()), orEmpty(u.bio()), orEmpty(u.avatarUrl()), time(u.createdAt())});
    }
    db.batchUpdate("insert into users (id, email, password_hash, username, full_name, bio, avatar_url, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)", rows);

    Set<String> posts = new HashSet<>();
    rows = new ArrayList<>();
    for (OldPost p : old.posts()) {
      if (!users.contains(p.userId()) || !posts.add(p.id())) continue;
      rows.add(new Object[] {
        p.id(), p.userId(), Objects.requireNonNullElse(p.mediaType(), "image"), p.imageUrl(), Objects.requireNonNullElse(p.filter(), "none"),
        p.music(), orEmpty(p.caption()), views.pollJson(p.poll()), time(p.createdAt())
      });
    }
    db.batchUpdate(
        "insert into posts (id, user_id, media_type, image_url, filter, music, caption, poll, created_at) values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)",
        rows);

    rows = new ArrayList<>();
    for (OldComment c : old.comments())
      if (posts.contains(c.postId()) && users.contains(c.userId()))
        rows.add(new Object[] {c.id(), c.postId(), c.userId(), c.body(), time(c.createdAt())});
    db.batchUpdate("insert into comments (id, post_id, user_id, body, created_at) values (?, ?, ?, ?, ?) on conflict do nothing", rows);

    rows = new ArrayList<>();
    for (OldLike l : old.likes())
      if (posts.contains(l.postId()) && users.contains(l.userId()))
        rows.add(new Object[] {l.postId(), l.userId(), Objects.requireNonNullElse(l.reaction(), "❤️")});
    db.batchUpdate("insert into reactions (post_id, user_id, reaction) values (?, ?, ?) on conflict do nothing", rows);

    rows = new ArrayList<>();
    for (OldVote v : old.pollVotes())
      if (posts.contains(v.postId()) && users.contains(v.userId())) rows.add(new Object[] {v.postId(), v.userId(), v.option()});
    db.batchUpdate("insert into poll_votes (post_id, user_id, option) values (?, ?, ?) on conflict do nothing", rows);

    rows = new ArrayList<>();
    for (OldFollow f : old.follows())
      if (users.contains(f.followerId()) && users.contains(f.followingId()) && !f.followerId().equals(f.followingId()))
        rows.add(new Object[] {f.followerId(), f.followingId()});
    db.batchUpdate("insert into follows (follower_id, following_id) values (?, ?) on conflict do nothing", rows);

    // Sessions too, so everyone stays logged in across the switch.
    rows = new ArrayList<>();
    for (OldSession s : old.sessions())
      if (users.contains(s.userId())) rows.add(new Object[] {s.token(), s.userId(), time(s.createdAt())});
    db.batchUpdate("insert into sessions (token, user_id, created_at) values (?, ?, ?) on conflict do nothing", rows);

    Set<String> stories = new HashSet<>();
    rows = new ArrayList<>();
    for (OldStory s : old.stories()) {
      if (!users.contains(s.userId()) || !stories.add(s.id())) continue;
      rows.add(new Object[] {
        s.id(), s.userId(), s.mediaType(), s.mediaUrl(), Objects.requireNonNullElse(s.filter(), "none"), s.music(), orEmpty(s.caption()),
        time(s.createdAt()), time(s.expiresAt())
      });
    }
    db.batchUpdate(
        "insert into stories (id, user_id, media_type, media_url, filter, music, caption, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rows);

    rows = new ArrayList<>();
    for (OldStoryView v : old.storyViews())
      if (stories.contains(v.storyId()) && users.contains(v.userId()))
        rows.add(new Object[] {v.storyId(), v.userId(), time(v.viewedAt()), v.reaction()});
    db.batchUpdate("insert into story_views (story_id, user_id, viewed_at, reaction) values (?, ?, ?, ?) on conflict do nothing", rows);

    rows = new ArrayList<>();
    for (OldMessage m : old.messages()) {
      if (!users.contains(m.fromId()) || !users.contains(m.toId())) continue;
      OldCall call = m.call();
      rows.add(new Object[] {
        m.id(), m.fromId(), m.toId(), orEmpty(m.body()), m.postId(), time(m.createdAt()),
        m.readAt() == null ? null : time(m.readAt()), m.reaction(),
        call == null ? null : call.kind(), call == null ? null : call.outcome(), call == null ? null : call.durationSec()
      });
    }
    db.batchUpdate(
        "insert into messages (id, from_id, to_id, body, post_id, created_at, read_at, reaction, call_kind, call_outcome, call_duration_sec) "
            + "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict do nothing",
        rows);

    if (old.sampleStoriesAt() != null) db.update("insert into app_state (key, value) values ('sampleStoriesAt', ?)", old.sampleStoriesAt());
    if (old.activityAt() != null) db.update("insert into app_state (key, value) values ('activityAt', ?)", old.activityAt());
  }

  // ---------------------------------------------------------------------------
  // Fresh sample data (the same generator as the old backend's seed())
  // ---------------------------------------------------------------------------

  private static Object hoursAgo(double hours) {
    return Times.sql(Times.now().minusMillis((long) (hours * 3_600_000)));
  }

  private void seed() {
    Samples.Data data = samples.data();
    DoubleSupplier rand = Rand.seeded(42);
    String passwordHash = Passwords.hash(data.password());
    List<String> userIds = data.users().stream().map(Samples.User::id).toList();

    for (Samples.User u : data.users())
      db.update(
          "insert into users (id, email, password_hash, username, full_name, bio, avatar_url, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)",
          u.id(), u.email(), passwordHash, u.username(), u.fullName(), u.bio(), u.avatarUrl(), hoursAgo(24 * 60));

    for (Samples.Post p : data.posts()) {
      Rows.NewPoll poll = data.polls().get(p.id());
      db.update(
          "insert into posts (id, user_id, media_type, image_url, filter, music, caption, poll, created_at) values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)",
          p.id(), p.userId(), p.mediaType(), p.imageUrl(), data.filters().getOrDefault(p.id(), "none"), data.music().get(p.id()),
          p.caption(), views.pollJson(poll), hoursAgo(p.hoursAgo()));
    }

    // Reactions and comments from other sample accounts.
    for (Samples.Post post : data.posts()) {
      List<String> others = userIds.stream().filter(id -> !id.equals(post.userId())).toList();
      for (String userId : others)
        if (rand.getAsDouble() < 0.45)
          db.update("insert into reactions (post_id, user_id, reaction) values (?, ?, ?)", post.id(), userId, Samples.randomReaction(rand));
      int count = (int) Math.floor(rand.getAsDouble() * 4);
      for (int i = 0; i < count; i++)
        db.update(
            "insert into comments (id, post_id, user_id, body, created_at) values (?, ?, ?, ?, ?)",
            "c-" + post.id() + "-" + i, post.id(), others.get(Rand.index(rand, others.size())), samples.randomComment(rand),
            hoursAgo(post.hoursAgo() * (0.9 - i * 0.2)));
    }

    // The demo account follows only a few people, so there's something to discover in search.
    for (String follower : userIds)
      for (String following : userIds) {
        if (follower.equals(following)) continue;
        double odds = follower.equals(Samples.DEMO_ID) ? 0.25 : 0.4;
        if (rand.getAsDouble() < odds) db.update("insert into follows (follower_id, following_id) values (?, ?)", follower, following);
      }

    // Votes on the sample polls. The demo account hasn't voted, so it can try polls out.
    for (var entry : data.polls().entrySet()) {
      Samples.Post post = data.posts().stream().filter(p -> p.id().equals(entry.getKey())).findFirst().orElse(null);
      if (post == null) continue;
      for (String userId : userIds) {
        if (userId.equals(Samples.DEMO_ID) || userId.equals(post.userId()) || rand.getAsDouble() > 0.7) continue;
        // Square the roll so earlier options win more often; even splits look fake.
        int option = (int) Math.floor(Math.pow(rand.getAsDouble(), 1.6) * entry.getValue().options().size());
        db.update("insert into poll_votes (post_id, user_id, option) values (?, ?, ?)", post.id(), userId, option);
      }
    }

    // The demo account's conversations.
    List<Samples.ChatMessage> messages = data.messages();
    for (int i = 0; i < messages.size(); i++) {
      Samples.ChatMessage m = messages.get(i);
      String other = "u-" + m.with();
      db.update(
          "insert into messages (id, from_id, to_id, body, post_id, created_at, read_at) values (?, ?, ?, ?, ?, ?, ?)",
          "m-sample-" + i,
          m.fromDemo() ? Samples.DEMO_ID : other,
          m.fromDemo() ? other : Samples.DEMO_ID,
          m.body(),
          m.postId(),
          hoursAgo(m.hoursAgo()),
          m.isUnread() ? null : hoursAgo(m.hoursAgo() - 0.1));
    }
  }
}
