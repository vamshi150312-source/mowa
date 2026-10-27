package dev.mova.service;

import dev.mova.web.ApiException;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Uploaded photos and videos, stored as files in data/uploads and served from
 * /api/media/<uuid>.<ext>. Only the URL goes in the database.
 */
@Service
public class MediaStore {
  private static final Map<String, String> EXTENSIONS = Map.of(
      "image/jpeg", "jpg",
      "image/png", "png",
      "image/webp", "webp",
      "image/gif", "gif",
      "video/mp4", "mp4",
      "video/webm", "webm",
      "video/quicktime", "mov");
  private static final Map<String, Long> MAX_BYTES = Map.of("image", 20L * 1024 * 1024, "video", 50L * 1024 * 1024);
  public static final String PREFIX = "/api/media/";
  private static final Pattern SAFE_NAME = Pattern.compile("^[0-9a-f-]{36}\\.[a-z0-9]{2,4}$");

  private final Path dir;

  public MediaStore(@Value("${mova.data-dir}") String dataDir) {
    this.dir = Path.of(dataDir).toAbsolutePath().normalize().resolve("uploads");
  }

  /** Saves an upload and returns the URL it's served from. */
  public String save(MultipartFile file, String mediaType) {
    String type = file.getContentType() == null ? "" : file.getContentType();
    String ext = EXTENSIONS.get(type);
    if (ext == null || !type.startsWith(mediaType + "/"))
      throw new ApiException(400, mediaType.equals("video") ? "Upload an MP4, WebM or MOV video." : "Upload a JPEG, PNG, WebP or GIF image.");
    long max = MAX_BYTES.get(mediaType);
    if (file.getSize() > max) throw new ApiException(413, "File is too large (max " + max / 1024 / 1024 + " MB).");
    String name = UUID.randomUUID() + "." + ext;
    try {
      Files.createDirectories(dir);
      file.transferTo(dir.resolve(name));
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    return PREFIX + name;
  }

  /** Deletes a file saved by {@link #save}. Other URLs (e.g. Unsplash) are ignored. */
  public void delete(String url) {
    if (url == null || !url.startsWith(PREFIX)) return;
    String name = url.substring(PREFIX.length());
    if (!SAFE_NAME.matcher(name).matches()) return;
    try {
      Files.deleteIfExists(dir.resolve(name));
    } catch (IOException ignored) {
      // Leave it; an orphaned file does no harm.
    }
  }

  /** The file for a media name, or null if there's no such upload. */
  public Path find(String name) {
    if (!SAFE_NAME.matcher(name).matches()) return null;
    Path file = dir.resolve(name);
    return Files.isRegularFile(file) ? file : null;
  }

  public static String contentType(String name) {
    String ext = name.substring(name.lastIndexOf('.') + 1);
    return EXTENSIONS.entrySet().stream()
        .filter(e -> e.getValue().equals(ext))
        .map(Map.Entry::getKey)
        .findFirst()
        .orElse("application/octet-stream");
  }
}
