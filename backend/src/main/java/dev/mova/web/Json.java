package dev.mova.web;

import java.util.LinkedHashMap;
import java.util.Map;

/** Small helpers for JSON responses and loosely typed JSON request bodies. */
public final class Json {
  private Json() {}

  /** The response for actions that return nothing else. */
  public static final Map<String, Object> OK = Map.of("ok", true);

  /** {"k1": v1, "k2": v2, ...}, allowing null values (unlike Map.of). */
  public static Map<String, Object> obj(Object... keysAndValues) {
    Map<String, Object> map = new LinkedHashMap<>();
    for (int i = 0; i < keysAndValues.length; i += 2) map.put((String) keysAndValues[i], keysAndValues[i + 1]);
    return map;
  }

  /** A string field, or "" if it's missing or not a string (like the old backend's str()). */
  public static String str(Map<String, Object> body, String key) {
    return body != null && body.get(key) instanceof String s ? s : "";
  }

  /** Form fields come in as strings or null. */
  public static String str(String value) {
    return value == null ? "" : value;
  }
}
