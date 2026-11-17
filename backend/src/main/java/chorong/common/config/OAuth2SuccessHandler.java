package chorong.common.config;

import chorong.common.util.AdminUtil;
import chorong.member.dto.SocialUserDTO;
import chorong.member.dto.oautn2.PrincipalDetails;
import chorong.member.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/*
 * 소셜 로그인 성공 뒤 처리 (MEM-01): 모두 {front.url}로 302 이동
 * - 관리자로 로그인 중: 로그인하지 않고 /login?error=ADMIN_LOGGED_IN
 * - 가입한 회원: /oauth/callback?result=LOGIN
 * - 신규: member를 만들지 않고 가입 대기에 10분 보관 → /oauth/callback?result=SIGNUP&needBirth=true|false
 */
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final AuthService authService;

    @Value("${front.url}")
    private String frontUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        HttpSession session = request.getSession();

        if (AdminUtil.getLoginAdmin(session) != null) {
            getRedirectStrategy().sendRedirect(request, response, frontUrl + "/login?error=ADMIN_LOGGED_IN");
            return;
        }

        SocialUserDTO social = ((PrincipalDetails) authentication.getPrincipal()).getSocialUser();

        String path;
        if (authService.login(session, social)) {
            path = "/oauth/callback?result=LOGIN";
        } else {
            authService.savePendingSignup(session, social);
            path = "/oauth/callback?result=SIGNUP&needBirth=" + social.needBirth();
        }
        getRedirectStrategy().sendRedirect(request, response, frontUrl + path);
    }
}
