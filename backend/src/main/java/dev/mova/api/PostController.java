package dev.mova.api;

import static dev.mova.web.Json.obj;
import static dev.mova.web.Json.str;

import dev.mova.domain.Dto;
import dev.mova.domain.Options;
import dev.mova.domain.Rand;
import dev.mova.domain.Rows;
import dev.mova.domain.Times;
import dev.mova.service.MediaStore;
import dev.mova.service.Simulation;
import dev.mova.service.Views;
import dev.mova.web.ApiException;
import dev.mova.web.Json;
import dev.mova.web.Viewer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** The feed, posts, reactions, poll votes and comments. */
@RestController
@RequestMapping("/api")
public class PostController {
  private final JdbcTemplate db;
  private final Views views;
  private final MediaStore media;
  private final Simulation simulation;
  private final JsonMapper json;

  public PostController(JdbcTemplate db, Views views, MediaStore media, Simulation simulation, JsonMapper json) {
    this.db = db;
    this.views = views;
    this.media = media;
    this.simulation = simulation;
    this.json = json;
  }

  // ---------------------------------------------------------------------------
  // Feed
  // ---------------------------------------------------------------------------

  private record Ranked(Rows.Post post, int reactions, int comments) {}

  /**
   * How high a post ranks. Every refresh gets a new seed, so the order changes:
   * home ("all") favours recent posts, popular posts and people you follow, with some shuffle;
   * Reels ("videos") is mostly shuffled, leaning a little towards newer and popular videos;
   * Explore is shuffled, leaning towards popular posts. Your own post from the last 30
   * minutes stays at the top of home so you can see it went out.
   */
  private static double score(Ranked r, String kind, String seed, long at, String meId, Set<String> followed) {
    Rows.Post row = r.post();
    double ageHours = Math.max(0, (at - row.createdAt().toEpochMilli()) / 3_600_000.0);
    double popularity = 1 + Math.log1p(r.reactions() + 2.0 * r.comments()) / 3;
    double shuffle = Rand.hash(seed + row.id());
    if (kind.equals("explore")) return popularity * (0.2 + 1.6 * shuffle);
    if (kind.equals("videos")) return (0.4 + 0.6 * Math.pow(0.5, ageHours / 96)) * popularity * (0.2 + 1.6 * shuffle);
    if (row.userId().equals(meId) && ageHours < 0.5) return 1e6 - ageHours;
    double recency = 0.25 + 0.75 * Math.pow(0.5, ageHours / 72);
    double following = meId != null && (followed.contains(row.userId()) || row.userId().equals(meId)) ? 1.6 : 1;
    return recency * popularity * following * (0.4 + 1.2 * shuffle);
  }

  @GetMapping("/feed")
  Dto.FeedPage feed(
      Viewer viewer,
      @RequestParam(required = false) String limit,
      @RequestParam(required = false) String kind,
      @RequestParam(required = false) String cursor) {
    int size = 10;
    try {
      size = Math.min(50, Math.max(1, Integer.parseInt(limit)));
    } catch (RuntimeException ignored) {
      // default
    }
    String feedKind = "videos".equals(kind) || "explore".equals(kind) ? kind : "all";

    // Cursor = "<seed>.<time>.<offset>". A first page starts a new random order; later
    // pages reuse its seed and time so the ranking doesn't change while scrolling.
    String seed = null;
    long at = 0;
    int offset = 0;
    String[] parts = cursor == null ? new String[0] : cursor.split("\\.");
    try {
      if (parts.length == 3 && !parts[0].isEmpty()) {
        at = Long.parseLong(parts[1]);
        offset = Integer.parseInt(parts[2]);
        seed = at != 0 ? parts[0] : null;
      }
    } catch (NumberFormatException ignored) {
      seed = null;
    }
    if (seed == null) {
      seed = Long.toString(ThreadLocalRandom.current().nextLong(Long.MAX_VALUE), 36);
      at = System.currentTimeMillis();
      offset = 0;
    }

    // New reactions and comments from the sample accounts since the last visit.
    if (offset == 0) simulation.activity();

    String meId = viewer.id();
    Set<String> followed = new HashSet<>(
        meId == null ? List.of() : db.queryForList("select following_id from follows where follower_id = ?", String.class, meId));
    List<Ranked> candidates = db.query(
        "select " + Rows.postColumns("p")
            + ", (select count(*) from reactions r where r.post_id = p.id) as reaction_count"
            + ", (select count(*) from comments c where c.post_id = p.id) as comment_count"
            + " from posts p where p.created_at <= now()" + (feedKind.equals("videos") ? " and p.media_type = 'video'" : ""),
        (rs, i) -> new Ranked(Rows.POST.mapRow(rs, i), rs.getInt("reaction_count"), rs.getInt("comment_count")));

    String finalSeed = seed;
    long finalAt = at;
    Map<Ranked, Double> scores = new HashMap<>();
    for (Ranked r : candidates) scores.put(r, score(r, feedKind, finalSeed, finalAt, meId, followed));
    List<Ranked> ranked = new ArrayList<>(candidates);
    ranked.sort(Comparator.<Ranked>comparingDouble(scores::get).reversed().thenComparing(r -> r.post().createdAt(), Comparator.reverseOrder()));

    List<Rows.Post> page = ranked.stream().skip(offset).limit(size).map(Ranked::post).toList();
    String next = offset + size < ranked.size() ? finalSeed + "." + finalAt + "." + (offset + size) : null;
    return new Dto.FeedPage(views.toPosts(page, meId), next);
  }

  // ---------------------------------------------------------------------------
  // Posts
  // ---------------------------------------------------------------------------

  private Rows.NewPoll parsePoll(String value) {
    if (value == null || value.isEmpty()) return null;
    Map<?, ?> raw;
    try {
      raw = json.readValue(value, Map.class);
    } catch (JacksonException e) {
      throw new ApiException(400, "Invalid poll.");
    }
    String question = raw.get("question") instanceof String q ? q.strip() : "";
    List<String> options = raw.get("options") instanceof List<?> list
        ? list.stream().map(o -> o instanceof String s ? s.strip() : "").toList()
        : List.of();
    Rows.NewPoll poll = new Rows.NewPoll(question, options);
    String invalid = Options.validatePoll(poll);
    if (invalid != null) throw new ApiException(400, invalid);
    return poll;
  }

  static String parseMusic(String value) {
    if (value == null || value.isEmpty()) return null;
    if (!Options.isTrack(value)) throw new ApiException(400, "Unknown music track.");
    return value;
  }

  @PostMapping("/posts")
  Map<String, Object> createPost(
      Viewer viewer,
      @RequestParam(required = false) MultipartFile media,
      @RequestParam(required = false) String mediaType,
      @RequestParam(required = false) String caption,
      @RequestParam(required = false) String filter,
      @RequestParam(required = false) String music,
      @RequestParam(required = false) String poll,
      @RequestParam(required = false) String publishAt) {
    Rows.User user = viewer.require();
    if (media == null || media.isEmpty()) throw new ApiException(400, "Choose a photo or video to share.");
    String type = "video".equals(mediaType) ? "video" : "image";
    String text = str(caption).strip();
    if (text.length() > 2200) throw new ApiException(400, "Caption must be 2,200 characters or fewer.");
    String filterId = filter == null ? "none" : filter;
    if (!Options.isFilter(filterId)) throw new ApiException(400, "Unknown filter.");
    String track = parseMusic(music);
    if (track != null && !type.equals("video")) throw new ApiException(400, "Music can only be added to videos.");
    Rows.NewPoll newPoll = parsePoll(poll);
    Instant publish = null;
    if (publishAt != null && !publishAt.isEmpty()) {
      publish = Times.parse(publishAt);
      String invalid = Options.validatePublishAt(publish);
      if (invalid != null) throw new ApiException(400, invalid);
    }

    String imageUrl = this.media.save(media, type);
    Rows.Post row = new Rows.Post(
        Simulation.newId(), user.id(), type, imageUrl, filterId, track, text, views.pollJson(newPoll), publish != null ? publish : Times.now());
    db.update(
        "insert into posts (id, user_id, media_type, image_url, filter, music, caption, poll, created_at) values (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)",
        row.id(), row.userId(), row.mediaType(), row.imageUrl(), row.filter(), row.music(), row.caption(), row.pollJson(), Times.sql(row.createdAt()));
    return obj("post", views.toPost(row, user.id()));
  }

  @GetMapping("/posts/{id}")
  Map<String, Object> getPost(Viewer viewer, @PathVariable String id) {
    Rows.Post row = views.postOrNull(id);
    return obj("post", row != null && row.visibleTo(viewer.id()) ? views.toPost(row, viewer.id()) : null);
  }

  @PutMapping("/posts/{id}/reaction")
  Map<String, Object> react(Viewer viewer, @PathVariable String id, @RequestBody Map<String, Object> body) {
    Rows.User user = viewer.require();
    views.visiblePost(id, user.id());
    Object reaction = body.get("reaction");
    if (!Options.isReaction(reaction)) throw new ApiException(400, "Unknown reaction.");
    db.update(
        "insert into reactions (post_id, user_id, reaction) values (?, ?, ?) on conflict (post_id, user_id) do update set reaction = excluded.reaction",
        id, user.id(), reaction);
    return Json.OK;
  }

  @DeleteMapping("/posts/{id}/reaction")
  Map<String, Object> unreact(Viewer viewer, @PathVariable String id) {
    Rows.User user = viewer.require();
    views.visiblePost(id, user.id());
    db.update("delete from reactions where post_id = ? and user_id = ?", id, user.id());
    return Json.OK;
  }

  @PutMapping("/posts/{id}/vote")
  Map<String, Object> vote(Viewer viewer, @PathVariable String id, @RequestBody Map<String, Object> body) {
    Rows.User user = viewer.require();
    Rows.Post post = views.visiblePost(id, user.id());
    Rows.NewPoll poll = views.poll(post);
    if (poll == null) throw new ApiException(400, "This post doesn't have a poll.");
    Object option = body.get("option");
    boolean integral = option instanceof Integer || option instanceof Long
        || (option instanceof Double d && d == Math.rint(d) && !d.isInfinite());
    int index = integral ? ((Number) option).intValue() : -1;
    if (!integral || index < 0 || index >= poll.options().size()) throw new ApiException(400, "That isn't one of the poll's options.");
    db.update(
        "insert into poll_votes (post_id, user_id, option) values (?, ?, ?) on conflict (post_id, user_id) do update set option = excluded.option",
        id, user.id(), index);
    return obj("poll", views.toPoll(id, poll, user.id()));
  }

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  @GetMapping("/posts/{id}/comments")
  Map<String, Object> comments(@PathVariable String id) {
    List<Dto.Comment> comments = db.query(
        "select c.id, c.post_id, c.body, c.created_at, u.id as author_id, u.username, u.full_name, u.bio, u.avatar_url"
            + " from comments c join users u on u.id = c.user_id where c.post_id = ? order by c.created_at",
        (rs, i) -> new Dto.Comment(
            rs.getString("id"),
            rs.getString("post_id"),
            new Dto.Profile(
                rs.getString("author_id"), rs.getString("username"), rs.getString("full_name"), rs.getString("bio"), rs.getString("avatar_url")),
            rs.getString("body"),
            Times.iso(Times.get(rs, "created_at"))),
        id);
    return obj("comments", comments);
  }

  @PostMapping("/posts/{id}/comments")
  Map<String, Object> addComment(Viewer viewer, @PathVariable String id, @RequestBody Map<String, Object> body) {
    Rows.User user = viewer.require();
    views.visiblePost(id, user.id());
    String text = str(body, "body").strip();
    if (text.isEmpty()) throw new ApiException(400, "Write a comment first.");
    if (text.length() > 2200) throw new ApiException(400, "Comment is too long.");
    String commentId = Simulation.newId();
    Instant now = Times.now();
    db.update("insert into comments (id, post_id, user_id, body, created_at) values (?, ?, ?, ?, ?)", commentId, id, user.id(), text, Times.sql(now));
    return obj("comment", new Dto.Comment(commentId, id, user.profile(), text, Times.iso(now)));
  }
}
