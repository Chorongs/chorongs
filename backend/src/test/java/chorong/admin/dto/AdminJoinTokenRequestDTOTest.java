package chorong.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

/*
 * 가입 인증 토큰 요청 (ADMIN-07) 입력 검사 (B2): 허용할 형식만 정의
 */
class AdminJoinTokenRequestDTOTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	@Test
	void 이름이_1자면_거절() {
		// Given
		AdminJoinTokenRequestDTO dto = new AdminJoinTokenRequestDTO("a@test.com", "김");

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}

	@Test
	void 이름이_21자면_거절() {
		// Given
		AdminJoinTokenRequestDTO dto = new AdminJoinTokenRequestDTO("a@test.com", "가".repeat(21));

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}

	@Test
	void 이름_앞뒤에_공백이_있으면_거절() {
		// Given
		AdminJoinTokenRequestDTO dto = new AdminJoinTokenRequestDTO("a@test.com", " 관리자");

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}
}
