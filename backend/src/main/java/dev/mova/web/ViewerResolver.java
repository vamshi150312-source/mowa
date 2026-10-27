package dev.mova.web;

import dev.mova.domain.Rows;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.List;
import org.springframework.core.MethodParameter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** Turns the session cookie into a {@link Viewer} for controller methods. */
@Component
public class ViewerResolver implements HandlerMethodArgumentResolver {
  private final JdbcTemplate db;

  public ViewerResolver(JdbcTemplate db) {
    this.db = db;
  }

  @Override
  public boolean supportsParameter(MethodParameter parameter) {
    return parameter.getParameterType() == Viewer.class;
  }

  @Override
  public Viewer resolveArgument(
      MethodParameter parameter, ModelAndViewContainer mav, NativeWebRequest request, WebDataBinderFactory binders) {
    HttpServletRequest http = request.getNativeRequest(HttpServletRequest.class);
    Cookie[] cookies = http == null ? null : http.getCookies();
    String token = cookies == null
        ? null
        : Arrays.stream(cookies).filter(c -> Viewer.COOKIE.equals(c.getName())).map(Cookie::getValue).findFirst().orElse(null);
    if (token == null || token.isEmpty()) return new Viewer(null, null);
    List<Rows.User> users = db.query(
        "select " + Rows.userColumns("u") + " from sessions s join users u on u.id = s.user_id where s.token = ?",
        Rows.USER,
        token);
    return new Viewer(users.isEmpty() ? null : users.get(0), token);
  }
}
