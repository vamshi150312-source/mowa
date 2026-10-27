package dev.mova.api;

import static dev.mova.web.Json.obj;
import static dev.mova.web.Json.str;

import dev.mova.domain.Dto;
import dev.mova.service.Calls;
import dev.mova.web.Json;
import dev.mova.web.Viewer;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Audio and video call signalling (see {@link Calls}). */
@RestController
@RequestMapping("/api/calls")
public class CallController {
  private final Calls calls;

  public CallController(Calls calls) {
    this.calls = calls;
  }

  @PostMapping
  Map<String, Object> start(Viewer viewer, @RequestBody Map<String, Object> body) {
    String kind = "video".equals(body.get("kind")) ? "video" : "audio";
    Dto.Call call = calls.start(viewer.require(), str(body, "userId"), kind);
    return obj("call", call);
  }

  @GetMapping("/incoming")
  Map<String, Object> incoming(Viewer viewer) {
    return obj("call", calls.incoming(viewer.require()));
  }

  @GetMapping("/{id}")
  Map<String, Object> poll(Viewer viewer, @PathVariable String id, @RequestParam(required = false) String after) {
    int since = 0;
    try {
      since = Integer.parseInt(after);
    } catch (RuntimeException ignored) {
      // 0
    }
    return calls.poll(viewer.require(), id, since);
  }

  @PostMapping("/{id}/accept")
  Map<String, Object> accept(Viewer viewer, @PathVariable String id) {
    calls.accept(viewer.require(), id);
    return Json.OK;
  }

  @PostMapping("/{id}/end")
  Map<String, Object> end(Viewer viewer, @PathVariable String id) {
    calls.end(viewer.require(), id);
    return Json.OK;
  }

  @PostMapping("/{id}/signal")
  Map<String, Object> signal(Viewer viewer, @PathVariable String id, @RequestBody Map<String, Object> body) {
    calls.signal(viewer.require(), id, body.get("type"), body.get("data"));
    return Json.OK;
  }
}
