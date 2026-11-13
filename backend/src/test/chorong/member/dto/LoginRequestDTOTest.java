package chorong.member.dto;

import chorong.member.entity.Member;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThat;

class LoginRequestDTOTest {
    @Test
    @DisplayName("카카오 JSON 응답을 파싱하면 생년월일은 null이고, 엔티티 변환 시 loginType은 대문자 KAKAO가 된다")
    void kakaoParsingAndToEntityTest() {
        // given: 카카오 서버가 보내주는 실제 JSON 구조와 똑같은 가짜 Map 생성
        Map<String, Object> profile = Map.of("nickname", "재영");
        Map<String, Object> kakaoAccount = Map.of("profile", profile);
        Map<String, Object> attributes = Map.of(
                "id", 123456789L,
                "kakao_account", kakaoAccount
        );

        // 팩토리 메서드로 DTO 생성 및 엔티티 변환 (일단은 약관 동의 시간 null로 테스트)
        LoginRequestDTO dto = LoginRequestDTO.of("kakao", attributes);
        Member member = dto.toEntity();


        assertThat(dto.getSocialId()).isEqualTo("123456789");
        assertThat(dto.getMemberNickname()).isEqualTo("재영");
        assertThat(dto.getBirthYear()).isNull(); // 카카오는 생년 못 받음

        assertThat(member.getLoginType()).isEqualTo("KAKAO");
        assertThat(member.getTermsAgreedAt()).isNull();
        assertThat(member.getMemberStatus()).isEqualTo(1);
    }

    @Test
    @DisplayName("네이버 JSON 응답을 파싱하면 생년월일까지 정상 추출되고, loginType은 대문자 NAVER가 된다")
    void naverParsingAndToEntityTest() {
        // given: 네이버 서버가 보내주는 JSON 구조 (response 키 안에 데이터가 들어있음)
        Map<String, Object> response = Map.of(
                "id", "naver_unique_id_999",
                "name", "재영",
                "birthyear", "1998",
                "birthday", "05-15"
        );
        Map<String, Object> attributes = Map.of("response", response);
        LocalDateTime now = LocalDateTime.now();


        LoginRequestDTO dto = LoginRequestDTO.of("naver", attributes);
        Member member = dto.toEntity();


        assertThat(member.getLoginType()).isEqualTo("NAVER");
        assertThat(member.getSocialId()).isEqualTo("naver_unique_id_999");
        assertThat(member.getBirthYear()).isEqualTo("1998");
        assertThat(member.getBirthDay()).isEqualTo("05-15");
        assertThat(member.getTermsAgreedAt()).isEqualTo(now);
    }
}