package chorong.member.dto.oautn2;

import chorong.member.dto.SocialUserDTO;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public class PrincipalDetails implements OAuth2User {

    private final SocialUserDTO socialUser; // 소셜에서 받은 값 (로그인 때 DB에 저장하지 않음)
    private final Map<String, Object> attributes; // 카카오/네이버에서 받은 원본 JSON 데이터

    // 생성자 (바깥에서 값이 바뀌지 않게 복사해서 보관, SpotBugs EI_EXPOSE_REP2)
    public PrincipalDetails(SocialUserDTO socialUser, Map<String, Object> attributes) {
        this.socialUser = socialUser.copy();
        this.attributes = Collections.unmodifiableMap(new LinkedHashMap<>(attributes));
    }

    // 소셜에서 받은 값 (복사본, SpotBugs EI_EXPOSE_REP)
    public SocialUserDTO getSocialUser() {
        return socialUser.copy();
    }

    // [OAuth2User 필수 오버라이딩 1] 원본 속성값 반환
    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    // [OAuth2User 필수 오버라이딩 2] 유저의 권한 반환 (일단 일반 유저로 고정)
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return Collections.singleton(new SimpleGrantedAuthority("ROLE_USER"));
    }

    // [OAuth2User 필수 오버라이딩 3] 유저의 고유 식별자 반환
    @Override
    public String getName() {
        // 소셜 고유번호 (카카오 id, 네이버 response.id)
        return socialUser.getSocialId();
    }

}
