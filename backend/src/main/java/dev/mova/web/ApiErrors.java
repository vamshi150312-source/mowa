package dev.mova.web;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Every error is sent as {"error": "..."}, the shape the frontend expects. */
@RestControllerAdvice
public class ApiErrors {
  private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

  private static ResponseEntity<Map<String, String>> error(int status, String message) {
    return ResponseEntity.status(status).body(Map.of("error", message));
  }

  @ExceptionHandler(ApiException.class)
  ResponseEntity<Map<String, String>> api(ApiException e) {
    return error(e.status(), e.getMessage());
  }

  @ExceptionHandler({NoResourceFoundException.class, HttpRequestMethodNotSupportedException.class})
  ResponseEntity<Map<String, String>> notFound(Exception e) {
    return error(404, "Not found.");
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<Map<String, String>> badBody(Exception e) {
    return error(400, "Invalid request body.");
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  ResponseEntity<Map<String, String>> tooLarge(Exception e) {
    return error(413, "File is too large (max 50 MB).");
  }

  @ExceptionHandler(MultipartException.class)
  ResponseEntity<Map<String, String>> badUpload(Exception e) {
    return error(400, "Invalid upload.");
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, String>> unexpected(Exception e) {
    log.error("Unhandled error", e);
    return error(500, "Something went wrong on the server.");
  }
}
