package chorong.member.service;

import chorong.member.dto.SocialUserDTO;
import chorong.member.dto.oautn2.PrincipalDetails;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

/*
 * 카카오, 네이버 사용자 정보 → SocialUserDTO (EXT-03, 04, MEM-01)
 * 로그인 때 DB에 저장하지 않음. 회원 확인과 가입 대기는 OAuth2SuccessHandler → AuthService
 */
@Service
public class SocialUserService extends DefaultOAuth2UserService {

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        // properties에 등록한 registrationId (kakao, naver)
        String provider = userRequest.getClientRegistration().getRegistrationId();

        try {
            SocialUserDTO socialUser = SocialUserDTO.of(provider, oAuth2User.getAttributes());
            return new PrincipalDetails(socialUser, oAuth2User.getAttributes());
        } catch (IllegalArgumentException e) {
            // 고유번호가 없는 등 사용자 정보가 이상하면 로그인 실패 (OAuth2FailureHandler → FAILED)
            throw new OAuth2AuthenticationException(new OAuth2Error("invalid_user_info"), e);
        }
    }
}
