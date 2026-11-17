package chorong.common.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/*
 * 소셜 로그인 실패 뒤 처리 (MEM-01): {front.url}/login?error=CANCELLED (취소, 동의 거부) 또는 FAILED
 */
@Slf4j
@Component
public class OAuth2FailureHandler implements AuthenticationFailureHandler {

    @Value("${front.url}")
    private String frontUrl;

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException {
        String error = "FAILED";
        String errorCode = exception.getClass().getSimpleName();
        if (exception instanceof OAuth2AuthenticationException oauth2Exception) {
            errorCode = oauth2Exception.getError().getErrorCode();
            if ("access_denied".equals(errorCode)) {
                error = "CANCELLED";
            }
        }
        // 실패 내용은 로그에 (토큰, 사용자 값은 남기지 않음, B13)
        log.warn("소셜 로그인 실패: {}", errorCode);
        response.sendRedirect(frontUrl + "/login?error=" + error);
    }
}
