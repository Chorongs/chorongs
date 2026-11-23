package chorong.search.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 간편 검색 요청 (SEARCH-02, POST /api/recommendations/keywords)
 * 키워드는 정해진 14개만, 중복은 빼고 최대 5개 (모르는 키워드, 6개 이상은 Service에서 400, B19)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KeywordSearchRequestDTO {

	@NotEmpty
	private List<String> keywords;

	@Pattern(regexp = "[0-9]{1,18}(,[0-9]{1,18})?")
	private String cmp;			// 비교함 상품 번호 1~2개 (쉼표, 첫 번째가 기준 상품). SEARCH-01과 같은 뜻
}
