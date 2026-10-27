package dev.mova.api;

import static dev.mova.web.Json.obj;
import static dev.mova.web.Json.str;

import dev.mova.domain.Dto;
import dev.mova.domain.Options;
import dev.mova.domain.Rows;
import dev.mova.domain.Times;
import dev.mova.service.Simulation;
import dev.mova.service.Views;
import dev.mova.web.ApiException;
import dev.mova.web.Json;
import dev.mova.web.Viewer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Direct messages. */
@RestController
@RequestMapping("/api")
public class ChatController {
  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  private final Views views;
  private final Simulation simulation;

  public ChatController(JdbcTemplate db, TransactionTemplate tx, Views views, Simulation simulation) {
    this.db = db;
    this.tx = tx;
    this.views = views;
    this.simulation = simulation;
  }

  @GetMapping("/chats")
  Map<String, Object> chats(Viewer viewer) {
    Rows.User me = viewer.require();
    simulation.pendingReplies(me.id());
    // Oldest first, so the last message seen for each person is their latest.
    record Chat(Rows.Message last, int unread) {}
    Map<String, Chat> chats = new LinkedHashMap<>();
    for (Rows.Message m : db.query(
        "select " + Rows.MESSAGE_COLUMNS + " from messages where from_id = ? or to_id = ? order by created_at",
        Rows.MESSAGE,
        me.id(),
        me.id())) {
      Chat chat = chats.get(m.otherParty(me.id()));
      int unread = (chat == null ? 0 : chat.unread()) + (m.toId().equals(me.id()) && m.readAt() == null ? 1 : 0);
      chats.put(m.otherParty(me.id()), new Chat(m, unread));
    }
    Map<String, Dto.Profile> users = views.profiles(chats.keySet());
    List<String> ids = chats.keySet().stream().filter(users::containsKey).toList();
    List<Dto.Message> lasts = views.toMessages(ids.stream().map(id -> chats.get(id).last()).toList(), me.id());
    List<Dto.ChatSummary> summaries = new ArrayList<>();
    for (int i = 0; i < ids.size(); i++) summaries.add(new Dto.ChatSummary(users.get(ids.get(i)), lasts.get(i), chats.get(ids.get(i)).unread()));
    summaries.sort(Comparator.comparing((Dto.ChatSummary c) -> c.lastMessage().createdAt()).reversed());
    return obj("chats", summaries);
  }

  @GetMapping("/chats/unread")
  Map<String, Object> unread(Viewer viewer) {
    Rows.User me = viewer.require();
    simulation.pendingReplies(me.id());
    return obj("count", db.queryForObject(
        "select count(distinct from_id) from messages where to_id = ? and read_at is null", Integer.class, me.id()));
  }

  @GetMapping("/chats/{userId}")
  Dto.ChatThread chat(Viewer viewer, @PathVariable String userId) {
    Rows.User me = viewer.require();
    views.user(userId);
    // Opening the chat reads their messages to me (and lets a sample account answer mine).
    if (simulation.replyDue(me.id(), userId)) simulation.replies(me.id(), userId);
    db.update("update messages set read_at = ? where from_id = ? and to_id = ? and read_at is null", Times.sql(Times.now()), userId, me.id());
    List<Rows.Message> rows = db.query(
        "select * from (select " + Rows.MESSAGE_COLUMNS + " from messages "
            + "where (from_id = ? and to_id = ?) or (from_id = ? and to_id = ?) order by created_at desc limit 200) recent "
            + "order by created_at",
        Rows.MESSAGE,
        me.id(), userId, userId, me.id());
    return new Dto.ChatThread(views.toMessages(rows, me.id()), simulation.isTyping(me.id(), userId));
  }

  @PostMapping("/chats/{userId}")
  Map<String, Object> send(Viewer viewer, @PathVariable String userId, @RequestBody Map<String, Object> body) {
    Rows.User me = viewer.require();
    if (userId.equals(me.id())) throw new ApiException(400, "You can't message yourself.");
    views.user(userId);
    String text = str(body, "body").strip();
    String postId = str(body, "postId");
    if (postId.isEmpty()) postId = null;
    if (text.isEmpty() && postId == null) throw new ApiException(400, "Write a message first.");
    if (text.length() > Options.MESSAGE_MAX) throw new ApiException(400, "Messages can be up to 1,000 characters.");
    if (postId != null) views.visiblePost(postId, me.id());

    Instant now = Times.now();
    Rows.Message row = new Rows.Message(Simulation.newId(), me.id(), userId, text, postId, now, null, null, null, null, null);
    tx.executeWithoutResult(s -> {
      // Answering someone also reads what they sent.
      db.update("update messages set read_at = ? where from_id = ? and to_id = ? and read_at is null", Times.sql(now), userId, me.id());
      db.update(
          "insert into messages (id, from_id, to_id, body, post_id, created_at) values (?, ?, ?, ?, ?, ?)",
          row.id(), row.fromId(), row.toId(), row.body(), row.postId(), Times.sql(now));
    });
    return obj("message", views.toMessages(List.of(row), me.id()).get(0));
  }

  private Rows.Message findMessage(String id, String meId) {
    List<Rows.Message> rows = db.query(
        "select " + Rows.MESSAGE_COLUMNS + " from messages where id = ? and (from_id = ? or to_id = ?)", Rows.MESSAGE, id, meId, meId);
    if (rows.isEmpty()) throw new ApiException(404, "This message isn't available anymore.");
    return rows.get(0);
  }

  @PutMapping("/messages/{id}/reaction")
  Map<String, Object> react(Viewer viewer, @PathVariable String id, @RequestBody Map<String, Object> body) {
    Rows.User me = viewer.require();
    Rows.Message message = findMessage(id, me.id());
    if (!message.toId().equals(me.id())) throw new ApiException(400, "You can only react to messages sent to you.");
    Object reaction = body.get("reaction");
    if (reaction != null && !Options.isReaction(reaction)) throw new ApiException(400, "Unknown reaction.");
    db.update("update messages set reaction = ? where id = ?", reaction, id);
    return Json.OK;
  }

  @DeleteMapping("/messages/{id}")
  Map<String, Object> unsend(Viewer viewer, @PathVariable String id) {
    Rows.User me = viewer.require();
    Rows.Message message = findMessage(id, me.id());
    if (!message.fromId().equals(me.id())) throw new ApiException(403, "You can only unsend your own messages.");
    db.update("delete from messages where id = ?", id);
    return Json.OK;
  }
}
