package chorong.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

/*
 * 관리자 토큰 로그인 (ADMIN-03) 입력 검사 (B2): 허용할 형식만 정의
 */
class AdminLoginRequestDTOTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	@Test
	void 토큰이_숫자_6자리면_통과() {
		// Given
		AdminLoginRequestDTO dto = new AdminLoginRequestDTO("a@test.com", "123456");

		// When, Then
		assertTrue(validator.validate(dto).isEmpty());
	}

	@Test
	void 토큰에_글자가_섞이면_거절() {
		// Given
		AdminLoginRequestDTO dto = new AdminLoginRequestDTO("a@test.com", "12a456");

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}
}
