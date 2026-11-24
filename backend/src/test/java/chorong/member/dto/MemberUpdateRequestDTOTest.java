package chorong.member.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/*
 * MemberUpdateRequestDTO 입력 검사 (MEM-11, B2)
 * 기대값 출처: be_member.md MEM-11 (요청 값 nickname, birthYear, birthDay 바꿀 것만 / 생년월일 형식)
 * 닉네임 길이(앞뒤 공백 제거 후 2~12자)와 생년월일의 미래, 1900년 이전, 없는 날짜는 서비스에서 확인 (MemberServiceImplTest)
 */
class MemberUpdateRequestDTOTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    private MemberUpdateRequestDTO dto(String nickname, String birthYear, String birthDay) {
        MemberUpdateRequestDTO dto = new MemberUpdateRequestDTO();
        dto.setMemberNickname(nickname);
        dto.setBirthYear(birthYear);
        dto.setBirthDay(birthDay);
        return dto;
    }

    @Test
    @DisplayName("값을 모두 안 보내도 검사를 통과한다 (바꿀 것만)")
    void allOmitted() {
        // Given
        MemberUpdateRequestDTO dto = dto(null, null, null);

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isZero();
    }

    @Test
    @DisplayName("닉네임과 올바른 형식의 생년월일이면 검사를 통과한다")
    void validRequest() {
        // Given
        MemberUpdateRequestDTO dto = dto("캐링", "1998", "05-15");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isZero();
    }

    @Test
    @DisplayName("출생연도가 숫자 4자리가 아니면 거절한다")
    void birthYearWrongFormat() {
        // Given
        MemberUpdateRequestDTO dto = dto(null, "98", "05-15");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isEqualTo(1);
    }

    @Test
    @DisplayName("출생연도에 숫자가 아닌 글자가 있으면 거절한다")
    void birthYearNotNumber() {
        // Given
        MemberUpdateRequestDTO dto = dto(null, "abcd", "05-15");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isEqualTo(1);
    }

    @Test
    @DisplayName("생일이 MM-DD 형식이 아니면 거절한다")
    void birthDayWrongFormat() {
        // Given
        MemberUpdateRequestDTO dto = dto(null, "1998", "13-40");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isEqualTo(1);
    }

    @Test
    @DisplayName("생일이 한 자리 월, 일(1-5)이면 거절한다")
    void birthDayNotZeroPadded() {
        // Given
        MemberUpdateRequestDTO dto = dto(null, "1998", "1-5");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isEqualTo(1);
    }
}
