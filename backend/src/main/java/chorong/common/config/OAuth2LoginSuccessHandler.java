package chorong.common.config;

import chorong.member.dto.oautn2.PrincipalDetails;
import chorong.member.entity.Member;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import java.io.IOException;

@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {


        PrincipalDetails principalDetails = (PrincipalDetails) authentication.getPrincipal();


        Member member = principalDetails.getMember();

        //조건에 따른 리다이렉트 분기 처리
        // 예: 약관 동의 시간이 비어있거나(신규 가입), 카카오 로그인이라 생년월일 정보가 없는 경우
        if (member.getTermsAgreedAt() == null || member.getBirthYear() == null) {

            // 추가 정보 입력 및 약관 동의 페이지로 강제 이동
            getRedirectStrategy().sendRedirect(request, response, "/member/extra-info");

        } else {

            // 모든 정보가 완벽한 기존 회원이면 메인 홈 화면으로 이동
            getRedirectStrategy().sendRedirect(request, response, "/");

        }
    }
}
