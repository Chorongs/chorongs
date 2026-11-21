package chorong.admin.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;

import chorong.common.dto.FastApiImportCheckResponseDTO;

/*
 * FastAPI 최신 확인 응답의 출처 목록을 옮겨 담는지 (원본 목록이 바뀌어도 응답은 그대로)
 */
class ImportCheckResponseDTOTest {

	@Test
	void 원본_출처_목록을_바꿔도_응답_목록은_그대로() {
		// Given
		List<FastApiImportCheckResponseDTO.SourceCheck> sources = new ArrayList<>(List.of(
				new FastApiImportCheckResponseDTO.SourceCheck("KINFA", null, true, "318", "318", 0, 0, null)));
		FastApiImportCheckResponseDTO fast = new FastApiImportCheckResponseDTO(null, sources, false, null);
		ImportCheckResponseDTO response = ImportCheckResponseDTO.from(fast);

		// When
		sources.add(new FastApiImportCheckResponseDTO.SourceCheck("FSS", null, false, "202611", "202612", null, null, null));

		// Then
		assertEquals(1, response.getSources().size());
	}
}
