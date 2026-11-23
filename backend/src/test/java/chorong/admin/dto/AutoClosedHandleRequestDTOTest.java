package chorong.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.stream.LongStream;

import org.junit.jupiter.api.Test;

import chorong.admin.entity.CheckResult;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

/*
 * 자동 내림 확인, 다시 게시 (ADMIN-10) 입력 검사 (B2, B10): 허용할 형식만 정의
 */
class AutoClosedHandleRequestDTOTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	@Test
	void 자동_내림_번호가_100개를_넘으면_거절() {
		// Given
		List<Long> ids = LongStream.rangeClosed(1, 101).boxed().toList();
		AutoClosedHandleRequestDTO dto = new AutoClosedHandleRequestDTO(ids, CheckResult.KEEP);

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}
}
