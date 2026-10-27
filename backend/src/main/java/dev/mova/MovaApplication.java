package dev.mova;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Mova's backend: the HTTP API under /api, backed by PostgreSQL. */
@SpringBootApplication
public class MovaApplication {
  public static void main(String[] args) {
    SpringApplication.run(MovaApplication.class, args);
  }
}
