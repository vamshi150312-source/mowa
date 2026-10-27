package dev.mova.api;

import static dev.mova.web.Json.obj;
import static dev.mova.web.Json.str;

import dev.mova.domain.Options;
import dev.mova.domain.Rows;
import dev.mova.domain.Times;
import dev.mova.service.MediaStore;
import dev.mova.service.Passwords;
import dev.mova.service.Simulation;
import dev.mova.service.Views;
import dev.mova.web.ApiException;
import dev.mova.web.Json;
import dev.mova.web.Viewer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Stream;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Sign-up, login and logout, and the signed-in user's own account settings. */
@RestController
@RequestMapping("/api")
public class AccountController {
  private final JdbcTemplate db;
  private final TransactionTemplate tx;
  private final Views views;
  private final MediaStore media;

  public AccountController(JdbcTemplate db, TransactionTemplate tx, Views views, MediaStore media) {
    this.db = db;
    this.tx = tx;
    this.views = views;
    this.media = media;
  }

  private static ResponseCookie sessionCookie(String token, long maxAge) {
    return ResponseCookie.from(Viewer.COOKIE, token).httpOnly(true).sameSite("Lax").path("/").maxAge(maxAge).build();
  }

  private ResponseEntity<Map<String, Object>> startSession(Rows.User user) {
    String token = Passwords.newToken();
    db.update("insert into sessions (token, user_id) values (?, ?)", token, user.id());
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, sessionCookie(token, Viewer.COOKIE_MAX_AGE).toString())
        .body(obj("user", user.profile()));
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  @GetMapping("/auth/me")
  Map<String, Object> me(Viewer viewer) {
    return obj("user", viewer.user() == null ? null : viewer.user().profile());
  }

  @PostMapping("/auth/signup")
  ResponseEntity<Map<String, Object>> signup(@RequestBody Map<String, Object> body) {
    String email = str(body, "email").strip().toLowerCase();
    String password = str(body, "password");
    String username = str(body, "username").strip().toLowerCase();
    String fullName = str(body, "fullName").strip();
    String invalid = Stream.of(
            Options.validateEmail(email), Options.validatePassword(password), Options.validateUsername(username), Options.validateFullName(fullName))
        .filter(Objects::nonNull)
        .findFirst()
        .orElse(null);
    if (invalid != null) throw new ApiException(400, invalid);

    if (db.queryForObject("select exists (select 1 from users where lower(email) = ?)", Boolean.class, email))
      throw new ApiException(409, "An account with this email already exists.");
    if (views.userByUsername(username) != null) throw new ApiException(409, "That username is taken.");
    Rows.User user = new Rows.User(Simulation.newId(), email, Passwords.hash(password), username, fullName, "", "", Times.now());
    try {
      db.update(
          "insert into users (id, email, password_hash, username, full_name, created_at) values (?, ?, ?, ?, ?, ?)",
          user.id(), user.email(), user.passwordHash(), user.username(), user.fullName(), Times.sql(user.createdAt()));
    } catch (DuplicateKeyException e) {
      throw new ApiException(409, "That username or email was just taken.");
    }
    return startSession(user);
  }

  @PostMapping("/auth/login")
  ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, Object> body) {
    String email = str(body, "email").strip().toLowerCase();
    List<Rows.User> users = db.query("select " + Rows.USER_COLUMNS + " from users where lower(email) = ?", Rows.USER, email);
    if (users.isEmpty() || !Passwords.verify(str(body, "password"), users.get(0).passwordHash()))
      throw new ApiException(401, "Incorrect email or password.");
    return startSession(users.get(0));
  }

  @PostMapping("/auth/logout")
  ResponseEntity<Map<String, Object>> logout(Viewer viewer) {
    if (viewer.sessionToken() != null) db.update("delete from sessions where token = ?", viewer.sessionToken());
    return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, sessionCookie("", 0).toString()).body(Json.OK);
  }

  // ---------------------------------------------------------------------------
  // Settings for the signed-in user
  // ---------------------------------------------------------------------------

  @PatchMapping("/me")
  Map<String, Object> updateProfile(
      Viewer viewer,
      @RequestParam(required = false) String fullName,
      @RequestParam(required = false) String username,
      @RequestParam(required = false) String bio,
      @RequestParam(required = false) MultipartFile avatar,
      @RequestParam(required = false) String removeAvatar) {
    Rows.User user = viewer.require();
    String name = str(fullName).strip();
    String handle = str(username).strip().toLowerCase();
    String about = str(bio).strip();
    String invalid = Objects.requireNonNullElse(Options.validateFullName(name), Objects.requireNonNullElse(Options.validateUsername(handle), ""));
    if (!invalid.isEmpty()) throw new ApiException(400, invalid);
    if (about.length() > 150) throw new ApiException(400, "Bio must be 150 characters or fewer.");

    String newAvatar = avatar != null && !avatar.isEmpty() ? media.save(avatar, "image") : null;
    String avatarUrl = newAvatar != null ? newAvatar : "1".equals(removeAvatar) ? "" : user.avatarUrl();
    try {
      Rows.User other = views.userByUsername(handle);
      if (other != null && !other.id().equals(user.id())) throw new ApiException(409, "That username is taken.");
      db.update("update users set full_name = ?, username = ?, bio = ?, avatar_url = ? where id = ?", name, handle, about, avatarUrl, user.id());
    } catch (RuntimeException e) {
      if (newAvatar != null) media.delete(newAvatar);
      if (e instanceof DuplicateKeyException) throw new ApiException(409, "That username is taken.");
      throw e;
    }
    if (!Objects.equals(user.avatarUrl(), avatarUrl)) media.delete(user.avatarUrl());
    return obj("user", views.user(user.id()).profile());
  }

  @PostMapping("/me/password")
  Map<String, Object> changePassword(Viewer viewer, @RequestBody Map<String, Object> body) {
    Rows.User user = viewer.require();
    if (!Passwords.verify(str(body, "currentPassword"), user.passwordHash()))
      throw new ApiException(400, "Your current password is incorrect.");
    String invalid = Options.validatePassword(str(body, "newPassword"));
    if (invalid != null) throw new ApiException(400, invalid);
    String hash = Passwords.hash(str(body, "newPassword"));
    // Sign out everywhere else.
    tx.executeWithoutResult(s -> {
      db.update("update users set password_hash = ? where id = ?", hash, user.id());
      db.update("delete from sessions where user_id = ? and token <> ?", user.id(), viewer.sessionToken());
    });
    return Json.OK;
  }

  @DeleteMapping("/me")
  ResponseEntity<Map<String, Object>> deleteAccount(Viewer viewer) {
    Rows.User user = viewer.require();
    List<String> files = new ArrayList<>();
    files.add(user.avatarUrl());
    files.addAll(db.queryForList("select image_url from posts where user_id = ?", String.class, user.id()));
    files.addAll(db.queryForList("select media_url from stories where user_id = ?", String.class, user.id()));
    // Everything else (posts, comments, reactions, follows, stories, messages, sessions) cascades.
    db.update("delete from users where id = ?", user.id());
    files.forEach(media::delete);
    return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, sessionCookie("", 0).toString()).body(Json.OK);
  }
}
