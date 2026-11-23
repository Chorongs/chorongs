package chorong.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

/*
 * 관리자 가입 신청 (ADMIN-07) 입력 검사 (B2): 허용할 형식만 정의
 */
class AdminJoinRequestDTOTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	@Test
	void 인증_토큰이_숫자_6자리면_통과() {
		// Given
		AdminJoinRequestDTO dto = new AdminJoinRequestDTO("a@test.com", "관리자", "123456");

		// When, Then
		assertTrue(validator.validate(dto).isEmpty());
	}

	@Test
	void 인증_토큰이_5자리면_거절() {
		// Given
		AdminJoinRequestDTO dto = new AdminJoinRequestDTO("a@test.com", "관리자", "12345");

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}
}
