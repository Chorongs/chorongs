package chorong.member.dto;

import chorong.member.entity.Member;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;

@Data
@Builder
public class LoginRequestDTO {
    private String provider; //loginType
    private String socialId;
    private String memberNickname;
    private String birthYear;
    private String birthDay;
    private String termAgreeAt;

    public static LoginRequestDTO of(String provider, Map<String, Object> attributes) {
        if ("naver".equals(provider)) {
            return ofNaver(provider, attributes);
        } else if ("kakao".equals(provider)) {
            return ofKakao(provider, attributes);
        }
        throw new IllegalArgumentException("지원하지 않는 로그인 제공자입니다.");
    }
    private static LoginRequestDTO ofNaver(String provider, Map<String, Object> attributes) {
        Map<String, Object> response = (Map<String, Object>) attributes.get("response");

        return LoginRequestDTO.builder()
                .provider(provider)
                .socialId((String) response.get("id"))
                .memberNickname((String) response.get("name"))
                .birthYear((String) response.get("birthyear"))
                .birthDay((String) response.get("birthday"))
                .build();
    }


    private static LoginRequestDTO ofKakao(String provider, Map<String, Object> attributes) {
        Map<String, Object> kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
        Map<String, Object> profile = (Map<String, Object>) kakaoAccount.get("profile");

        return LoginRequestDTO.builder()
                .provider(provider)
                .socialId(String.valueOf(attributes.get("id")))
                .memberNickname((String) profile.get("nickname"))
                .birthYear(null)
                .birthDay(null)
                .build();
    }
    public Member toEntity() {
        return Member.builder()
                .loginType(this.provider.toUpperCase())
                .socialId(this.socialId)
                .memberNickname(this.memberNickname)
                .birthYear(this.birthYear)
                .birthDay(this.birthDay)
                .memberStatus(1)
                .termsAgreedAt(LocalDateTime.now())
                 .createdAt(LocalDateTime.now())
                .build();
    }
}
