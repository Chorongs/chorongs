package chorong.member.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SignupRequestDTOTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    @DisplayName("약관에 동의하고 생년월일 형식이 맞으면 검사를 통과한다")
    void validRequest() {
        // Given
        SignupRequestDTO dto = new SignupRequestDTO(true, "1998", "05-15");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isZero();
    }

    @Test
    @DisplayName("약관 동의가 false면 거절한다")
    void termsAgreedFalse() {
        // Given
        SignupRequestDTO dto = new SignupRequestDTO(false, "1998", "05-15");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isEqualTo(1);
    }

    @Test
    @DisplayName("약관 동의 값이 없으면 거절한다")
    void termsAgreedNull() {
        // Given
        SignupRequestDTO dto = new SignupRequestDTO(null, "1998", "05-15");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isGreaterThanOrEqualTo(1);
    }

    @Test
    @DisplayName("출생연도가 숫자 4자리가 아니면 거절한다")
    void birthYearWrongFormat() {
        // Given
        SignupRequestDTO dto = new SignupRequestDTO(true, "98", "05-15");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isEqualTo(1);
    }

    @Test
    @DisplayName("생일이 MM-DD 형식이 아니면 거절한다")
    void birthDayWrongFormat() {
        // Given
        SignupRequestDTO dto = new SignupRequestDTO(true, "1998", "13-40");

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isEqualTo(1);
    }

    @Test
    @DisplayName("생년월일을 안 보내도(네이버 값 사용) 검사를 통과한다")
    void birthOmitted() {
        // Given
        SignupRequestDTO dto = new SignupRequestDTO(true, null, null);

        // When
        int violations = validator.validate(dto).size();

        // Then
        assertThat(violations).isZero();
    }
}
