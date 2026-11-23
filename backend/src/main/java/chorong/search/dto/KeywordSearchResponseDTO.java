package chorong.search.dto;

import java.util.List;

import chorong.product.dto.ProductSummaryDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 간편 검색 응답 (SEARCH-02): 추천 목록 (최대 5개) + 1위 상품이 못 맞춘 키워드
 * 요약 문장은 프론트가 이 값으로 만듦. 충족 0건이면 items가 빈 목록 (오류 아님)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KeywordSearchResponseDTO {

	private List<Item> items;				// 충족 키워드 수 많은 순 (최대 5개)
	private List<String> missedKeywords;	// 1위 상품이 못 맞춘 키워드 (고른 순서)
	private Integer hiddenCount;			// 충족 키워드가 1개 이상인 상품 중 비교함 기준(cmp)으로 빠진 수 (cmp가 없으면 0)

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class Item {
		private ProductSummaryDTO product;	// 상품 한 줄
		private List<String> reasons;		// 충족한 키워드의 이유 문구 (고른 키워드 순서)
		private Integer matchedCount;		// 충족한 키워드 수 (= reasons 개수)
	}
}
