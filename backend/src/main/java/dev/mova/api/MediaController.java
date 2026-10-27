package dev.mova.api;

import dev.mova.service.MediaStore;
import java.nio.file.Path;
import java.time.Duration;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Serves uploaded photos and videos. Spring handles Range requests, so videos stream and seek. */
@RestController
public class MediaController {
  private final MediaStore media;

  public MediaController(MediaStore media) {
    this.media = media;
  }

  @GetMapping("/api/media/{name:.+}")
  ResponseEntity<Resource> serve(@PathVariable String name) {
    Path file = media.find(name);
    if (file == null) return ResponseEntity.notFound().build();
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(MediaStore.contentType(name)))
        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
        .header("Accept-Ranges", "bytes")
        .body(new FileSystemResource(file));
  }
}
