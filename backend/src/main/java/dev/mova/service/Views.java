package dev.mova.service;

import dev.mova.domain.Dto;
import dev.mova.domain.Rows;
import dev.mova.domain.Times;
import dev.mova.web.ApiException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/**
 * Lookups shared by the controllers, and turning rows into the API's JSON shapes. Posts
 * are hydrated a page at a time, with one query each for reactions, comment counts and
 * poll votes rather than one per post.
 */
@Service
public class Views {
  private final JdbcTemplate db;
  private final JsonMapper json;

  public Views(JdbcTemplate db, JsonMapper json) {
    this.db = db;
    this.json = json;
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  public Rows.User userOrNull(String id) {
    List<Rows.User> rows = db.query("select " + Rows.USER_COLUMNS + " from users where id = ?", Rows.USER, id);
    return rows.isEmpty() ? null : rows.get(0);
  }

  public Rows.User user(String id) {
    Rows.User user = userOrNull(id);
    if (user == null) throw new ApiException(404, "User not found.");
    return user;
  }

  public Rows.User userByUsername(String username) {
    List<Rows.User> rows = db.query("select " + Rows.USER_COLUMNS + " from users where username = ?", Rows.USER, username);
    return rows.isEmpty() ? null : rows.get(0);
  }

  public Map<String, Dto.Profile> profiles(Collection<String> ids) {
    Map<String, Dto.Profile> map = new HashMap<>();
    if (ids.isEmpty()) return map;
    db.query(
        "select " + Rows.USER_COLUMNS + " from users where id = any(?)",
        Rows.USER,
        (Object) ids.stream().distinct().toArray(String[]::new))
        .forEach(u -> map.put(u.id(), u.profile()));
    return map;
  }

  public int followerCount(String userId) {
    return db.queryForObject("select count(*) from follows where following_id = ?", Integer.class, userId);
  }

  // ---------------------------------------------------------------------------
  // Posts
  // ---------------------------------------------------------------------------

  public Rows.Post postOrNull(String id) {
    List<Rows.Post> rows = db.query("select " + Rows.POST_COLUMNS + " from posts where id = ?", Rows.POST, id);
    return rows.isEmpty() ? null : rows.get(0);
  }

  /** A post the viewer may see, or a 404. */
  public Rows.Post visiblePost(String id, String viewerId) {
    Rows.Post post = postOrNull(id);
    if (post == null || !post.visibleTo(viewerId)) throw new ApiException(404, "This post isn't available.");
    return post;
  }

  public Rows.NewPoll poll(Rows.Post row) {
    return row.pollJson() == null ? null : json.readValue(row.pollJson(), Rows.NewPoll.class);
  }

  public String pollJson(Rows.NewPoll poll) {
    return poll == null ? null : json.writeValueAsString(poll);
  }

  public Dto.Poll toPoll(String postId, Rows.NewPoll poll, String viewerId) {
    int[] votes = new int[poll.options().size()];
    Integer[] mine = {null};
    db.query("select user_id, option from poll_votes where post_id = ?", rs -> {
      int option = rs.getInt("option");
      if (option < votes.length) votes[option]++;
      if (rs.getString("user_id").equals(viewerId)) mine[0] = option;
    }, postId);
    List<Dto.PollOption> options = new ArrayList<>();
    for (int i = 0; i < votes.length; i++) options.add(new Dto.PollOption(poll.options().get(i), votes[i]));
    return new Dto.Poll(poll.question(), options, mine[0]);
  }

  public Dto.Post toPost(Rows.Post row, String viewerId) {
    return toPosts(List.of(row), viewerId).get(0);
  }

  /** Posts with their authors, reaction totals, comment counts and polls, in the given order. */
  public List<Dto.Post> toPosts(List<Rows.Post> rows, String viewerId) {
    if (rows.isEmpty()) return List.of();
    Object ids = rows.stream().map(Rows.Post::id).toArray(String[]::new);
    Map<String, Dto.Profile> authors = profiles(rows.stream().map(Rows.Post::userId).toList());

    Map<String, Map<String, Integer>> reactions = new HashMap<>();
    Map<String, String> mine = new HashMap<>();
    db.query("select post_id, user_id, reaction from reactions where post_id = any(?)", rs -> {
      String postId = rs.getString("post_id");
      String reaction = rs.getString("reaction");
      reactions.computeIfAbsent(postId, k -> new LinkedHashMap<>()).merge(reaction, 1, Integer::sum);
      if (rs.getString("user_id").equals(viewerId)) mine.put(postId, reaction);
    }, ids);

    Map<String, Integer> comments = new HashMap<>();
    db.query(
        "select post_id, count(*) as n from comments where post_id = any(?) group by post_id",
        rs -> {
          comments.put(rs.getString("post_id"), rs.getInt("n"));
        },
        ids);

    List<Dto.Post> posts = new ArrayList<>();
    for (Rows.Post row : rows) {
      Rows.NewPoll poll = poll(row);
      posts.add(new Dto.Post(
          row.id(),
          authors.get(row.userId()),
          row.mediaType(),
          row.imageUrl(),
          row.filter(),
          row.music(),
          row.caption(),
          Times.iso(row.createdAt()),
          reactions.getOrDefault(row.id(), Map.of()),
          mine.get(row.id()),
          comments.getOrDefault(row.id(), 0),
          poll == null ? null : toPoll(row.id(), poll, viewerId)));
    }
    return posts;
  }

  // ---------------------------------------------------------------------------
  // Stories
  // ---------------------------------------------------------------------------

  /** Stories with seen / my reaction / view counts for the viewer. */
  public List<Dto.Story> toStories(List<Rows.Story> rows, String viewerId) {
    if (rows.isEmpty()) return List.of();
    Map<String, Dto.Profile> authors = profiles(rows.stream().map(Rows.Story::userId).toList());
    Map<String, Integer> viewCounts = new HashMap<>();
    Map<String, String> myView = new HashMap<>(); // story id -> my reaction ("" for none)
    db.query(
        "select story_id, user_id, reaction from story_views where story_id = any(?)",
        rs -> {
          String storyId = rs.getString("story_id");
          viewCounts.merge(storyId, 1, Integer::sum);
          if (rs.getString("user_id").equals(viewerId)) {
            String reaction = rs.getString("reaction");
            myView.put(storyId, reaction == null ? "" : reaction);
          }
        },
        (Object) rows.stream().map(Rows.Story::id).toArray(String[]::new));
    return rows.stream().map(r -> {
      boolean mineStory = r.userId().equals(viewerId);
      String reaction = myView.get(r.id());
      return new Dto.Story(
          r.id(),
          authors.get(r.userId()),
          r.mediaType(),
          r.mediaUrl(),
          r.filter(),
          r.music(),
          r.caption(),
          Times.iso(r.createdAt()),
          Times.iso(r.expiresAt()),
          mineStory || reaction != null,
          reaction == null || reaction.isEmpty() ? null : reaction,
          mineStory ? viewCounts.getOrDefault(r.id(), 0) : null);
    }).toList();
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  public List<Dto.Message> toMessages(List<Rows.Message> rows, String viewerId) {
    List<String> postIds = rows.stream().map(Rows.Message::postId).filter(id -> id != null).distinct().toList();
    Map<String, Dto.Post> posts = new HashMap<>();
    if (!postIds.isEmpty()) {
      List<Rows.Post> visible = db.query(
              "select " + Rows.POST_COLUMNS + " from posts where id = any(?)", Rows.POST, (Object) postIds.toArray(String[]::new))
          .stream()
          .filter(p -> p.visibleTo(viewerId))
          .toList();
      toPosts(visible, viewerId).forEach(p -> posts.put(p.id(), p));
    }
    return rows.stream().map(m -> {
      Dto.Post post = m.postId() == null ? null : posts.get(m.postId());
      Dto.CallRecord call = m.callKind() == null
          ? null
          : new Dto.CallRecord(m.callKind(), m.callOutcome(), m.callDurationSec() == null ? 0 : m.callDurationSec());
      return new Dto.Message(
          m.id(),
          m.fromId(),
          m.body(),
          post,
          m.postId() != null && post == null,
          Times.iso(m.createdAt()),
          Times.iso(m.readAt()),
          m.reaction(),
          call);
    }).toList();
  }
}
