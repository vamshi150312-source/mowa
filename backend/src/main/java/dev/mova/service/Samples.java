package dev.mova.service;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import dev.mova.domain.Rows;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.DoubleSupplier;
import java.util.stream.Collectors;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * The sample accounts and content (seed/samples.json): accounts, posts, Reels, stories,
 * polls, filters, music, chats, and the text sample accounts comment and reply with.
 */
@Component
public class Samples {
  @JsonIgnoreProperties(ignoreUnknown = true)
  public record User(String id, String email, String username, String fullName, String bio, String avatarUrl) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Post(String id, String userId, String mediaType, String imageUrl, String caption, double hoursAgo) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Story(String userKey, String mediaType, String url, String caption, String music) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ChatMessage(String with, boolean fromDemo, String body, String postId, double hoursAgo, Boolean unread) {
    public boolean isUnread() {
      return Boolean.TRUE.equals(unread);
    }
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Data(
      String password,
      String demoEmail,
      List<User> users,
      List<Post> posts,
      Map<String, Rows.NewPoll> polls,
      Map<String, String> filters,
      Map<String, String> music,
      List<Story> stories,
      List<ChatMessage> messages,
      List<String> commentPool,
      List<String> chatOpeners,
      Map<String, List<String>> replies) {}

  public static final String DEMO_ID = "u-demo";

  private final Data data;
  private final Set<String> userIds;

  public Samples(JsonMapper json) {
    try (InputStream in = new ClassPathResource("seed/samples.json").getInputStream()) {
      data = json.readValue(in, Data.class);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    userIds = data.users().stream().map(User::id).collect(Collectors.toUnmodifiableSet());
  }

  public Data data() {
    return data;
  }

  /** Is this one of the sample accounts (including the demo account)? */
  public boolean isSample(String userId) {
    return userIds.contains(userId);
  }

  /** Mostly ❤️, with the other reactions mixed in. */
  public static String randomReaction(DoubleSupplier rand) {
    List<String> r = dev.mova.domain.Options.REACTIONS;
    return rand.getAsDouble() < 0.55 ? r.get(0) : r.get(1 + (int) Math.floor(rand.getAsDouble() * (r.size() - 1)));
  }

  public String randomComment(DoubleSupplier rand) {
    return data.commentPool().get((int) Math.floor(rand.getAsDouble() * data.commentPool().size()));
  }

  /** A sample account's reply to a message. `roll` in [0, 1) picks one. */
  public String chatReply(String body, boolean sharedPost, double roll) {
    String text = body.toLowerCase();
    String pool;
    if (sharedPost && text.isBlank()) pool = "post";
    else if (text.matches("(?s)^\\s*(hi|hey|hello|hiya|yo|sup|hola)\\b.*")) pool = "greeting";
    else if (text.matches("(?s).*\\b(thanks|thank you|thx|ty)\\b.*")) pool = "thanks";
    else if (text.contains("?")) pool = "question";
    else if (sharedPost) pool = "post";
    else pool = "general";
    List<String> options = data.replies().get(pool);
    return options.get((int) Math.floor(roll * options.size()));
  }
}
