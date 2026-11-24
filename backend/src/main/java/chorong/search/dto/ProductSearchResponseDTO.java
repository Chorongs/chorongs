package chorong.search.dto;

import java.util.List;

import chorong.product.dto.ProductSummaryDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 상품 상세 검색 응답 (SEARCH-01): 공통 쪽 나눔 { list, total, page, size } + 금리 탭별 건수
 * total은 지금 금리 탭(rt)의 전체 건수, numCount, memoCount는 rt 조건을 뺀 건수 (화면 '검색 결과 N건' = 둘의 합)
 * 세 건수는 비교함 기준(cmp)으로 거른 뒤 값, hiddenCount는 그 기준 때문에 빠진 수
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductSearchResponseDTO {

	private List<ProductSummaryDTO> list;	// 이번 쪽 상품
	private Long total;						// 지금 금리 탭의 전체 건수
	private Integer page;					// 현재 쪽 번호 (1부터)
	private Integer size;					// 한 쪽 개수
	private Integer numCount;				// 금리 안내 건수 (금리 숫자가 있는 상품)
	private Integer memoCount;				// 금리 기관 문의 건수 (금리 숫자가 없는 상품)
	private Integer hiddenCount;			// 비교함 기준 때문에 빠진 상품 수 (지금 금리 탭 기준, cmp가 없으면 0)
}
