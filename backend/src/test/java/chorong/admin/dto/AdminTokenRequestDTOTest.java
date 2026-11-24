package chorong.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

/*
 * 관리자 토큰 요청 (ADMIN-02) 입력 검사 (B2): 허용할 형식만 정의
 */
class AdminTokenRequestDTOTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	@Test
	void 이메일_형식이_아니면_거절() {
		// Given
		AdminTokenRequestDTO dto = new AdminTokenRequestDTO("not-email");

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}
}
