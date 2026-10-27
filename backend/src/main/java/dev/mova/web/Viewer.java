package dev.mova.web;

import dev.mova.domain.Rows;

/**
 * Who is making the request: the signed-in user, or nobody. Add a Viewer parameter to a
 * controller method to get it.
 */
public record Viewer(Rows.User user, String sessionToken) {
  public static final String COOKIE = "sg_session";
  public static final int COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

  /** The signed-in user, or a 401 error. */
  public Rows.User require() {
    if (user == null) throw new ApiException(401, "You need to be logged in.");
    return user;
  }

  /** The signed-in user's id, or null. */
  public String id() {
    return user == null ? null : user.id();
  }
}
