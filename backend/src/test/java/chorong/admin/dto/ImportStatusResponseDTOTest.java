package chorong.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import chorong.common.dto.FastApiImportResponseDTO;

/*
 * FastAPI 응답 목록을 복사해 담는지 (원본 목록이 바뀌어도 응답은 그대로)
 */
class ImportStatusResponseDTOTest {

	@Test
	void 원본_목록을_바꿔도_응답_목록은_그대로() {
		// Given
		List<String> changedFields = new ArrayList<>(List.of("rate_min"));
		FastApiImportResponseDTO.Item item = new FastApiImportResponseDTO.Item(
				1L, "CHANGE", 10L, "상품", "기관", "FSS", changedFields, null, "N");
		FastApiImportResponseDTO fast = new FastApiImportResponseDTO(3L, "DONE", 7L, List.of(), List.of(item));
		ImportStatusResponseDTO response = ImportStatusResponseDTO.from(fast);

		// When
		changedFields.add("tags");

		// Then
		assertEquals(List.of("rate_min"), response.getItems().get(0).getChangedFields());
	}
}
