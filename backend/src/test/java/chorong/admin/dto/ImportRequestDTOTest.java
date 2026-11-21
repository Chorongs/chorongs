package chorong.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;

import org.junit.jupiter.api.Test;

import chorong.product.entity.Source;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

/*
 * 최신 상품 갱신 (ADMIN-04) 입력 검사 (B2): 허용할 형식만 정의
 */
class ImportRequestDTOTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	@Test
	void 출처가_3개면_거절() {
		// Given
		ImportRequestDTO dto = new ImportRequestDTO(List.of(Source.KINFA, Source.FSS, Source.FSS));

		// When, Then
		assertEquals(1, validator.validate(dto).size());
	}
}
