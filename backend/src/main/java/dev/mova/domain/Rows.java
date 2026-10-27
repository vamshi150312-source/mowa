package dev.mova.domain;

import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.RowMapper;

/** Rows as stored in PostgreSQL, with their JDBC row mappers. */
public final class Rows {
  private Rows() {}

  public record User(
      String id, String email, String passwordHash, String username, String fullName, String bio, String avatarUrl, Instant createdAt) {
    public Dto.Profile profile() {
      return new Dto.Profile(id, username, fullName, bio, avatarUrl);
    }
  }

  public static final String USER_COLUMNS = "id, email, password_hash, username, full_name, bio, avatar_url, created_at";

  /** USER_COLUMNS for a joined table, e.g. "u.id, u.email, ...". */
  public static String userColumns(String alias) {
    return USER_COLUMNS.replaceAll("(\\w+)", alias + ".$1");
  }
  public static final RowMapper<User> USER = (rs, i) -> new User(
      rs.getString("id"),
      rs.getString("email"),
      rs.getString("password_hash"),
      rs.getString("username"),
      rs.getString("full_name"),
      rs.getString("bio"),
      rs.getString("avatar_url"),
      Times.get(rs, "created_at"));

  public record NewPoll(String question, List<String> options) {}

  public record Post(
      String id, String userId, String mediaType, String imageUrl, String filter, String music, String caption, String pollJson, Instant createdAt) {
    public boolean isLive() {
      return !createdAt.isAfter(Instant.now());
    }

    /** Scheduled posts are hidden from everyone but their author until their publish time. */
    public boolean visibleTo(String viewerId) {
      return isLive() || userId.equals(viewerId);
    }
  }

  public static final String POST_COLUMNS = postColumns("posts");

  /** Post columns of a (possibly aliased) posts table, for {@link #POST}. */
  public static String postColumns(String table) {
    return String.join(", ",
        table + ".id", table + ".user_id", table + ".media_type", table + ".image_url", table + ".filter",
        table + ".music", table + ".caption", table + ".poll::text as poll", table + ".created_at");
  }

  public static final RowMapper<Post> POST = (rs, i) -> new Post(
      rs.getString("id"),
      rs.getString("user_id"),
      rs.getString("media_type"),
      rs.getString("image_url"),
      rs.getString("filter"),
      rs.getString("music"),
      rs.getString("caption"),
      rs.getString("poll"),
      Times.get(rs, "created_at"));

  public record Story(
      String id, String userId, String mediaType, String mediaUrl, String filter, String music, String caption, Instant createdAt, Instant expiresAt) {}

  public static final String STORY_COLUMNS = "id, user_id, media_type, media_url, filter, music, caption, created_at, expires_at";
  public static final RowMapper<Story> STORY = (rs, i) -> new Story(
      rs.getString("id"),
      rs.getString("user_id"),
      rs.getString("media_type"),
      rs.getString("media_url"),
      rs.getString("filter"),
      rs.getString("music"),
      rs.getString("caption"),
      Times.get(rs, "created_at"),
      Times.get(rs, "expires_at"));

  public record Message(
      String id,
      String fromId,
      String toId,
      String body,
      String postId,
      Instant createdAt,
      Instant readAt,
      String reaction,
      String callKind,
      String callOutcome,
      Integer callDurationSec) {
    public String otherParty(String meId) {
      return fromId.equals(meId) ? toId : fromId;
    }
  }

  public static final String MESSAGE_COLUMNS =
      "id, from_id, to_id, body, post_id, created_at, read_at, reaction, call_kind, call_outcome, call_duration_sec";
  public static final RowMapper<Message> MESSAGE = (rs, i) -> new Message(
      rs.getString("id"),
      rs.getString("from_id"),
      rs.getString("to_id"),
      rs.getString("body"),
      rs.getString("post_id"),
      Times.get(rs, "created_at"),
      Times.get(rs, "read_at"),
      rs.getString("reaction"),
      rs.getString("call_kind"),
      rs.getString("call_outcome"),
      (Integer) rs.getObject("call_duration_sec"));
}
