package dev.mova.api;

import static dev.mova.web.Json.obj;
import static dev.mova.web.Json.str;

import dev.mova.domain.Dto;
import dev.mova.domain.Options;
import dev.mova.domain.Rows;
import dev.mova.domain.Times;
import dev.mova.service.MediaStore;
import dev.mova.service.Simulation;
import dev.mova.service.Views;
import dev.mova.web.ApiException;
import dev.mova.web.Json;
import dev.mova.web.Viewer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

/** Stories: photos and videos that disappear 24 hours after they're posted. */
@RestController
@RequestMapping("/api")
public class StoryController {
  private final JdbcTemplate db;
  private final Views views;
  private final MediaStore media;
  private final Simulation simulation;

  public StoryController(JdbcTemplate db, Views views, MediaStore media, Simulation simulation) {
    this.db = db;
    this.views = views;
    this.media = media;
    this.simulation = simulation;
  }

  /** Live stories, oldest first. */
  private List<Rows.Story> live(String userId) {
    return db.query(
        "select " + Rows.STORY_COLUMNS + " from stories where expires_at > now()" + (userId != null ? " and user_id = ?" : "")
            + " order by created_at",
        Rows.STORY,
        userId != null ? new Object[] {userId} : new Object[0]);
  }

  private Rows.Story findLive(String id) {
    List<Rows.Story> rows = db.query(
        "select " + Rows.STORY_COLUMNS + " from stories where id = ? and expires_at > now()", Rows.STORY, id);
    if (rows.isEmpty()) throw new ApiException(404, "This story isn't available anymore.");
    return rows.get(0);
  }

  /**
   * Groups stories by author for the stories bar: you first, then people with unseen
   * stories (people you follow before others), then people you've fully watched. Within
   * each tier, whoever posted most recently comes first.
   */
  private static List<Dto.StoryGroup> group(List<Dto.Story> stories, String meId, Set<String> followed) {
    Map<String, List<Dto.Story>> byUser = new LinkedHashMap<>();
    for (Dto.Story s : stories) byUser.computeIfAbsent(s.author().id(), k -> new ArrayList<>()).add(s);
    List<Dto.StoryGroup> groups = new ArrayList<>();
    for (List<Dto.Story> list : byUser.values())
      groups.add(new Dto.StoryGroup(list.get(0).author(), list, list.stream().allMatch(Dto.Story::seen)));
    Comparator<Dto.StoryGroup> byTier = Comparator.comparingInt(
        g -> g.author().id().equals(meId) ? 0 : g.allSeen() ? 3 : followed.contains(g.author().id()) ? 1 : 2);
    Comparator<Dto.StoryGroup> byLatest = Comparator.comparing(g -> g.stories().get(g.stories().size() - 1).createdAt());
    groups.sort(byTier.thenComparing(byLatest.reversed()));
    return groups;
  }

  @GetMapping("/stories")
  Map<String, Object> stories(Viewer viewer) {
    simulation.freshStories();
    Set<String> followed = new HashSet<>(viewer.id() == null
        ? List.of()
        : db.queryForList("select following_id from follows where follower_id = ?", String.class, viewer.id()));
    return obj("groups", group(views.toStories(live(null), viewer.id()), viewer.id(), followed));
  }

  @GetMapping("/users/{id}/stories")
  Map<String, Object> userStories(Viewer viewer, @PathVariable String id) {
    simulation.freshStories();
    return obj("stories", views.toStories(live(id), viewer.id()));
  }

  @PostMapping("/stories")
  Map<String, Object> create(
      Viewer viewer,
      @RequestParam(required = false) MultipartFile media,
      @RequestParam(required = false) String mediaType,
      @RequestParam(required = false) String caption,
      @RequestParam(required = false) String filter,
      @RequestParam(required = false) String music) {
    Rows.User user = viewer.require();
    if (media == null || media.isEmpty()) throw new ApiException(400, "Choose a photo or video for your story.");
    String type = "video".equals(mediaType) ? "video" : "image";
    String text = str(caption).strip();
    if (text.length() > Options.STORY_MAX_CAPTION)
      throw new ApiException(400, "Story text can be up to " + Options.STORY_MAX_CAPTION + " characters.");
    String filterId = filter == null ? "none" : filter;
    if (!Options.isFilter(filterId)) throw new ApiException(400, "Unknown filter.");
    String track = PostController.parseMusic(music);

    String mediaUrl = this.media.save(media, type);
    Instant now = Times.now();
    Rows.Story row = new Rows.Story(
        Simulation.newId(), user.id(), type, mediaUrl, filterId, track, text, now, now.plus(Duration.ofHours(Options.STORY_HOURS)));
    db.update(
        "insert into stories (id, user_id, media_type, media_url, filter, music, caption, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        row.id(), row.userId(), row.mediaType(), row.mediaUrl(), row.filter(), row.music(), row.caption(),
        Times.sql(row.createdAt()), Times.sql(row.expiresAt()));
    return obj("story", views.toStories(List.of(row), user.id()).get(0));
  }

  @DeleteMapping("/stories/{id}")
  Map<String, Object> delete(Viewer viewer, @PathVariable String id) {
    Rows.User user = viewer.require();
    Rows.Story story = findLive(id);
    if (!story.userId().equals(user.id())) throw new ApiException(403, "You can only delete your own stories.");
    db.update("delete from stories where id = ?", id);
    media.delete(story.mediaUrl());
    return Json.OK;
  }

  /** Records that I viewed a story, optionally setting my reaction. Viewing your own doesn't count. */
  private void recordView(String storyId, Rows.User user, boolean setReaction, String reaction) {
    Rows.Story story = findLive(storyId);
    if (story.userId().equals(user.id())) {
      if (setReaction) throw new ApiException(400, "You can't react to your own story.");
      return;
    }
    if (setReaction)
      db.update(
          "insert into story_views (story_id, user_id, reaction) values (?, ?, ?) "
              + "on conflict (story_id, user_id) do update set reaction = excluded.reaction",
          storyId, user.id(), reaction);
    else db.update("insert into story_views (story_id, user_id) values (?, ?) on conflict do nothing", storyId, user.id());
  }

  @PutMapping("/stories/{id}/view")
  Map<String, Object> view(Viewer viewer, @PathVariable String id) {
    recordView(id, viewer.require(), false, null);
    return Json.OK;
  }

  @PutMapping("/stories/{id}/reaction")
  Map<String, Object> react(Viewer viewer, @PathVariable String id, @RequestBody Map<String, Object> body) {
    Object reaction = body.get("reaction");
    if (reaction != null && !Options.isReaction(reaction)) throw new ApiException(400, "Unknown reaction.");
    recordView(id, viewer.require(), true, (String) reaction);
    return Json.OK;
  }

  @GetMapping("/stories/{id}/viewers")
  Map<String, Object> viewers(Viewer viewer, @PathVariable String id) {
    Rows.User user = viewer.require();
    Rows.Story story = findLive(id);
    if (!story.userId().equals(user.id())) throw new ApiException(403, "Only the author can see who viewed a story.");
    List<Dto.StoryViewer> viewers = db.query(
        "select v.viewed_at, v.reaction, " + Rows.userColumns("u")
            + " from story_views v join users u on u.id = v.user_id where v.story_id = ? order by v.viewed_at desc",
        (rs, i) -> new Dto.StoryViewer(Rows.USER.mapRow(rs, i).profile(), Times.iso(Times.get(rs, "viewed_at")), rs.getString("reaction")),
        id);
    return obj("viewers", viewers);
  }
}
