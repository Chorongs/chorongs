package chorong.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.LongStream;

import org.junit.jupiter.api.Test;

import chorong.admin.entity.CheckResult;
import chorong.product.entity.Source;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

/*
 * 관리자 요청 입력 검사 (B2, B10): 허용할 형식만 정의
 */
class AdminRequestValidationTest {

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

	@Test
	void 이메일_형식이_아니면_거절() {
		// Given
		AdminTokenRequestDTO dto = new AdminTokenRequestDTO("not-email");

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}

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

	@Test
	void 자동_내림_번호가_100개를_넘으면_거절() {
		// Given
		List<Long> ids = LongStream.rangeClosed(1, 101).boxed().toList();
		AutoClosedHandleRequestDTO dto = new AutoClosedHandleRequestDTO(ids, CheckResult.KEEP);

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}

	@Test
	void 출처가_3개면_거절() {
		// Given
		ImportRequestDTO dto = new ImportRequestDTO(List.of(Source.KINFA, Source.FSS, Source.FSS));

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}
}
