package dev.mova.domain;

import java.util.function.DoubleSupplier;

/** The same small random helpers the old Node backend used. */
public final class Rand {
  private Rand() {}

  /** Deterministic number in [0, 1) from a string (FNV-1a over UTF-16 code units, like JavaScript). */
  public static double hash(String text) {
    int h = (int) 2166136261L;
    for (int i = 0; i < text.length(); i++) h = (h ^ text.charAt(i)) * 16777619;
    return (h & 0xffffffffL) / 4294967296.0;
  }

  /** Small seeded PRNG (mulberry32), so generated sample data is the same every time. */
  public static DoubleSupplier seeded(int seed) {
    int[] state = {seed};
    return () -> {
      state[0] += 0x6D2B79F5;
      int s = state[0];
      int t = (s ^ (s >>> 15)) * (1 | s);
      t = (t + ((t ^ (t >>> 7)) * (61 | t))) ^ t;
      return ((t ^ (t >>> 14)) & 0xffffffffL) / 4294967296.0;
    };
  }

  public static int index(DoubleSupplier rand, int size) {
    return (int) Math.floor(rand.getAsDouble() * size);
  }
}
