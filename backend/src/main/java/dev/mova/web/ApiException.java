package dev.mova.web;

/** Throw from anywhere in a request to send {"error": message} with this HTTP status. */
public class ApiException extends RuntimeException {
  private final int status;

  public ApiException(int status, String message) {
    super(message);
    this.status = status;
  }

  public int status() {
    return status;
  }
}
