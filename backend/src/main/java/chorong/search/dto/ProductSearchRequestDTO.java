package chorong.search.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 상품 상세 검색 요청 (SEARCH-01, GET /api/products 쿼리 값)
 * 필터 8개는 칩 값을 쉼표로 이은 글 (예: region=서울,부산). 값이 정해진 목록에 있는지, 칩 20개 이하인지는 Service에서 확인 (B19)
 * 비어 있으면 기본값: rt NUM, sort base, page 1, size 20
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductSearchRequestDTO {

	@Size(max = 50)
	private String q;			// 검색어 (50자까지)

	@Size(max = 1000)
	private String target;		// 지원 대상

	@Size(max = 1000)
	private String purpose;		// 자금 용도

	@Size(max = 1000)
	private String amount;		// 필요 금액

	@Size(max = 1000)
	private String repay;		// 상환 방법

	@Size(max = 1000)
	private String fin;			// 금융권 (세분류 값)

	@Size(max = 1000)
	private String inst;		// 취급기관

	@Size(max = 1000)
	private String region;		// 지원 지역

	@Size(max = 1000)
	private String credit;		// 신용점수 구간

	@Pattern(regexp = "NUM|MEMO")
	private String rt;			// NUM 금리 표시 / MEMO 금리 기관 문의

	@Pattern(regexp = "base|rate|limit|views")
	private String sort;		// 기본 순 / 금리 낮은 순 / 한도 높은 순 / 많이 본 순

	@Min(1)
	@Max(100000)
	private Integer page;		// 1부터

	@Min(1)
	@Max(50)
	private Integer size;		// 최대 50 (B10)
}
