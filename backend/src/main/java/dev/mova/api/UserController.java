package dev.mova.api;

import static dev.mova.web.Json.obj;

import dev.mova.domain.Dto;
import dev.mova.domain.Rows;
import dev.mova.service.Views;
import dev.mova.web.ApiException;
import dev.mova.web.Json;
import dev.mova.web.Viewer;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Profiles, follows, search and suggested accounts. */
@RestController
@RequestMapping("/api")
public class UserController {
  private final JdbcTemplate db;
  private final Views views;

  public UserController(JdbcTemplate db, Views views) {
    this.db = db;
    this.views = views;
  }

  /** Users with their follower counts, for sorting by popularity. */
  private static final String USERS_BY_FOLLOWERS = "select " + Rows.userColumns("u")
      + ", (select count(*) from follows f where f.following_id = u.id) as follower_count from users u ";

  @GetMapping("/users/by-username/{username}")
  Map<String, Object> byUsername(@PathVariable String username) {
    Rows.User user = views.userByUsername(username.toLowerCase());
    return obj("user", user == null ? null : user.profile());
  }

  @GetMapping("/users/{id}/stats")
  Dto.ProfileStats stats(@PathVariable String id) {
    return new Dto.ProfileStats(
        db.queryForObject("select count(*) from posts where user_id = ? and created_at <= now()", Integer.class, id),
        views.followerCount(id),
        db.queryForObject("select count(*) from follows where follower_id = ?", Integer.class, id));
  }

  @GetMapping("/users/{id}/posts")
  Map<String, Object> posts(Viewer viewer, @PathVariable String id) {
    List<Rows.Post> rows = db.query(
        "select " + Rows.POST_COLUMNS + " from posts where user_id = ? and (created_at <= now() or user_id = ?) order by created_at desc",
        Rows.POST,
        id,
        viewer.id() == null ? "" : viewer.id());
    return obj("posts", views.toPosts(rows, viewer.id()));
  }

  @GetMapping("/users/{id}/follow")
  Map<String, Object> isFollowing(Viewer viewer, @PathVariable String id) {
    boolean following = viewer.id() != null
        && db.queryForObject(
            "select exists (select 1 from follows where follower_id = ? and following_id = ?)", Boolean.class, viewer.id(), id);
    return obj("following", following);
  }

  @PutMapping("/users/{id}/follow")
  Map<String, Object> follow(Viewer viewer, @PathVariable String id) {
    return setFollow(viewer, id, true);
  }

  @DeleteMapping("/users/{id}/follow")
  Map<String, Object> unfollow(Viewer viewer, @PathVariable String id) {
    return setFollow(viewer, id, false);
  }

  private Map<String, Object> setFollow(Viewer viewer, String id, boolean follow) {
    Rows.User user = viewer.require();
    views.user(id);
    if (id.equals(user.id())) throw new ApiException(400, "You can't follow yourself.");
    if (follow)
      db.update("insert into follows (follower_id, following_id) values (?, ?) on conflict do nothing", user.id(), id);
    else db.update("delete from follows where follower_id = ? and following_id = ?", user.id(), id);
    return Json.OK;
  }

  @GetMapping("/search")
  Map<String, Object> search(@RequestParam(required = false) String q) {
    String query = q == null ? "" : q.strip().toLowerCase().replaceFirst("^@", "");
    if (query.isEmpty()) return obj("users", List.of());
    // Username matches first, then full-name matches, then the rest; most-followed first within each.
    String like = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    String prefix = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    List<Dto.Profile> users = db.query(
        USERS_BY_FOLLOWERS
            + "where u.username like ? or lower(u.full_name) like ? "
            + "order by case when u.username like ? then 0 when lower(u.full_name) like ? then 1 else 2 end, follower_count desc, u.created_at, u.username "
            + "limit 30",
        (rs, i) -> Rows.USER.mapRow(rs, i).profile(),
        like, like, prefix, prefix);
    return obj("users", users);
  }

  @GetMapping("/suggested")
  Map<String, Object> suggested(Viewer viewer, @RequestParam(required = false) String limit) {
    int size = 10;
    try {
      size = Math.min(50, Math.max(1, Integer.parseInt(limit)));
    } catch (RuntimeException ignored) {
      // default
    }
    String me = viewer.id() == null ? "" : viewer.id();
    List<Dto.Profile> users = db.query(
        USERS_BY_FOLLOWERS
            + "where u.id <> ? and u.id not in (select following_id from follows where follower_id = ?) "
            + "order by follower_count desc, u.created_at, u.username limit ?",
        (rs, i) -> Rows.USER.mapRow(rs, i).profile(),
        me, me, size);
    return obj("users", users);
  }
}
