package chorong.member.dto.oautn2;

import chorong.member.entity.Member;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;

@Getter
public class PrincipalDetails implements OAuth2User {

    private final Member member; // 찐 핵심! 우리가 DB에서 꺼낸 유저 엔티티
    private final Map<String, Object> attributes; // 카카오/네이버에서 받은 원본 JSON 데이터

    // 생성자
    public PrincipalDetails(Member member, Map<String, Object> attributes) {
        this.member = member;
        this.attributes = attributes;
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
        // providerId (카카오 고유번호 등)를 반환하거나 DB의 memberId를 문자열로 반환해도 됩니다.
        return member.getSocialId();
    }

}
