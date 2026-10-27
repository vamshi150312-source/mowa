package dev.mova.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Validation and fixed options, matching the frontend's src/lib/validation.ts,
 * postOptions.ts, music.ts and chat.ts (so error messages are the same everywhere).
 */
public final class Options {
  private Options() {}

  public static final List<String> REACTIONS = List.of("❤️", "🔥", "😂", "😮", "😢", "👏");
  public static final List<String> FILTERS = List.of("none", "vivid", "warm", "cool", "fade", "retro", "dream", "noir");
  /** Soundtrack ids from src/lib/music.ts. */
  public static final List<String> TRACKS = List.of(
      "carefree", "life-of-riley", "monkeys-spinning-monkeys", "fluffing-a-duck", "sneaky-snitch", "funky-chunk",
      "hyperfun", "club-diver", "groove-grove", "inspired", "dreamer", "chill-wave", "airport-lounge",
      "bossa-antigua", "jazz-brunch", "easy-lemon", "beachfront-celebration", "night-vigil");

  public static final int STORY_HOURS = 24;
  public static final int STORY_MAX_CAPTION = 200;
  public static final int MESSAGE_MAX = 1000;
  public static final int MAX_SCHEDULE_DAYS = 30;

  public static boolean isReaction(Object value) {
    return value instanceof String s && REACTIONS.contains(s);
  }

  public static boolean isFilter(Object value) {
    return value instanceof String s && FILTERS.contains(s);
  }

  public static boolean isTrack(Object value) {
    return value instanceof String s && TRACKS.contains(s);
  }

  private static final Pattern USERNAME = Pattern.compile("^[a-z0-9._]{3,30}$");
  private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

  /** Each returns an error message, or null when the value is valid. */
  public static String validateEmail(String email) {
    if (email.isBlank()) return "Email is required.";
    if (!EMAIL.matcher(email.strip()).matches()) return "Enter a valid email address.";
    return null;
  }

  public static String validatePassword(String password) {
    if (password.isEmpty()) return "Password is required.";
    if (password.length() < 8) return "Password must be at least 8 characters.";
    return null;
  }

  public static String validateUsername(String username) {
    if (username.isEmpty()) return "Username is required.";
    if (username.length() < 3 || username.length() > 30) return "Username must be 3–30 characters.";
    if (!USERNAME.matcher(username).matches()) return "Use only lowercase letters, numbers, periods and underscores.";
    return null;
  }

  public static String validateFullName(String name) {
    if (name.isBlank()) return "Full name is required.";
    if (name.strip().length() > 60) return "Full name must be 60 characters or fewer.";
    return null;
  }

  /** Expects trimmed strings. */
  public static String validatePoll(Rows.NewPoll poll) {
    String question = poll.question();
    List<String> options = poll.options();
    if (question.isEmpty()) return "Add a question to your poll.";
    if (question.length() > 100) return "Poll questions can be up to 100 characters.";
    if (options.size() < 2 || options.size() > 4) return "Polls need 2 to 4 options.";
    if (options.stream().anyMatch(String::isEmpty)) return "Fill in every poll option, or remove the empty ones.";
    if (options.stream().anyMatch(o -> o.length() > 40)) return "Poll options can be up to 40 characters.";
    var lower = new HashSet<String>();
    for (String o : options) lower.add(o.toLowerCase(Locale.ROOT));
    if (lower.size() != options.size()) return "Poll options must be different.";
    return null;
  }

  public static String validatePublishAt(Instant time) {
    Instant now = Instant.now();
    if (time == null) return "Pick a date and time to post.";
    if (!time.isAfter(now)) return "Pick a time in the future.";
    if (time.isAfter(now.plus(Duration.ofDays(MAX_SCHEDULE_DAYS)))) return "You can schedule up to 30 days ahead.";
    return null;
  }
}
