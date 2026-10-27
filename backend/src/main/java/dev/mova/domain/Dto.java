package dev.mova.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

/** The JSON the API sends. Mirrors the types in the frontend's src/lib/types.ts. */
public final class Dto {
  private Dto() {}

  public record Profile(String id, String username, String fullName, String bio, String avatarUrl) {}

  public record PollOption(String text, int votes) {}

  public record Poll(String question, List<PollOption> options, Integer myVote) {}

  public record Post(
      String id,
      Profile author,
      String mediaType,
      String imageUrl,
      String filter,
      String music,
      String caption,
      String createdAt,
      Map<String, Integer> reactions,
      String myReaction,
      int commentCount,
      Poll poll) {}

  public record FeedPage(List<Post> posts, String nextCursor) {}

  public record Comment(String id, String postId, Profile author, String body, String createdAt) {}

  public record ProfileStats(int posts, int followers, int following) {}

  public record Story(
      String id,
      Profile author,
      String mediaType,
      String mediaUrl,
      String filter,
      String music,
      String caption,
      String createdAt,
      String expiresAt,
      boolean seen,
      String myReaction,
      /** Only on your own stories. */
      @JsonInclude(JsonInclude.Include.NON_NULL) Integer viewCount) {}

  public record StoryGroup(Profile author, List<Story> stories, boolean allSeen) {}

  public record StoryViewer(Profile user, String viewedAt, String reaction) {}

  public record CallRecord(String kind, String outcome, int durationSec) {}

  public record Message(
      String id,
      String senderId,
      String body,
      Post post,
      boolean postUnavailable,
      String createdAt,
      String readAt,
      String reaction,
      CallRecord call) {}

  public record ChatSummary(Profile user, Message lastMessage, int unread) {}

  public record ChatThread(List<Message> messages, boolean typing) {}

  public record Call(String id, String kind, Profile caller, Profile callee, String status, String endReason) {}

  public record CallSignal(int seq, String type, Object data) {}
}
