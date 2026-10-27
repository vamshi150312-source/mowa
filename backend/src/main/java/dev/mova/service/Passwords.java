package dev.mova.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import org.bouncycastle.crypto.generators.SCrypt;

/**
 * scrypt password hashes stored as "salthex:hashhex", with Node's default parameters
 * (N=16384, r=8, p=1, 32-byte key). Same format as the old Node backend, so accounts
 * imported from it keep working.
 */
public final class Passwords {
  private Passwords() {}

  private static final SecureRandom RANDOM = new SecureRandom();
  private static final HexFormat HEX = HexFormat.of();

  private static byte[] derive(String password, byte[] salt) {
    return SCrypt.generate(password.getBytes(StandardCharsets.UTF_8), salt, 16384, 8, 1, 32);
  }

  public static String hash(String password) {
    byte[] salt = new byte[16];
    RANDOM.nextBytes(salt);
    return HEX.formatHex(salt) + ":" + HEX.formatHex(derive(password, salt));
  }

  public static boolean verify(String password, String stored) {
    String[] parts = stored == null ? new String[0] : stored.split(":");
    if (parts.length != 2 || parts[0].isEmpty() || parts[1].isEmpty()) return false;
    try {
      return MessageDigest.isEqual(derive(password, HEX.parseHex(parts[0])), HEX.parseHex(parts[1]));
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  public static String newToken() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return HEX.formatHex(bytes);
  }
}
