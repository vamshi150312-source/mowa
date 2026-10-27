package dev.mova.domain;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;

/**
 * Times in the API are ISO strings with exactly three decimals ("2026-10-12T10:30:30.970Z"),
 * like JavaScript's toISOString(). The frontend sorts some of them as strings, which only
 * works when they all have the same format.
 */
public final class Times {
  private Times() {}

  private static final DateTimeFormatter ISO =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

  public static String iso(Instant time) {
    return time == null ? null : ISO.format(time);
  }

  /** Now, to the millisecond (what the API can represent). */
  public static Instant now() {
    return Instant.now().truncatedTo(ChronoUnit.MILLIS);
  }

  /** For JDBC parameters (the PostgreSQL driver takes OffsetDateTime, not Instant). */
  public static OffsetDateTime sql(Instant time) {
    return time == null ? null : OffsetDateTime.ofInstant(time, ZoneOffset.UTC);
  }

  public static Instant get(ResultSet rs, String column) throws SQLException {
    OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
    return value == null ? null : value.toInstant();
  }

  /** Parses an ISO time from a client or the old database; null if it isn't one. */
  public static Instant parse(String text) {
    if (text == null || text.isBlank()) return null;
    try {
      return OffsetDateTime.parse(text).toInstant().truncatedTo(ChronoUnit.MILLIS);
    } catch (RuntimeException e) {
      return null;
    }
  }
}
