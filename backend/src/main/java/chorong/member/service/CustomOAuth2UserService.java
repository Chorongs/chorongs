package chorong.member.service;

import chorong.member.dto.LoginRequestDTO;
import chorong.member.dto.oautn2.PrincipalDetails;
import chorong.member.entity.Member;
import chorong.member.repository.MemberRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import java.util.Optional;

@RequiredArgsConstructor
@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {
    private final MemberRepository memberRepository;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {

        OAuth2User oAuth2User = super.loadUser(userRequest);

        // properties에 적어둔 Registration ID (소문자 "kakao" 또는 "naver") 추출
        String provider = userRequest.getClientRegistration().getRegistrationId();

        // 최상위 기준점 추출 (카카오는 "id", 네이버는 "response")
        String userNameAttributeName = userRequest.getClientRegistration()
                .getProviderDetails().getUserInfoEndpoint().getUserNameAttributeName();


        LoginRequestDTO dto = LoginRequestDTO.of(provider, oAuth2User.getAttributes());

        Member member = MemberSave(dto);

        //스프링 시큐리티의 세션에 담길 인증 객체를 만들어 반환
        return new PrincipalDetails(member, oAuth2User.getAttributes());
    }

    // 신규/기존 유저 분기 처리
    private Member MemberSave(LoginRequestDTO dto) {


        Optional<Member> optionalMember = memberRepository.findByLoginTypeAndProviderId(
                dto.getProvider().toUpperCase(),
                dto.getSocialId()
        );
        if(optionalMember.isPresent()) {
            return optionalMember.get();
        }else {
            Member newMember = dto.toEntity();
            return memberRepository.save(newMember);
        }
    }
}
