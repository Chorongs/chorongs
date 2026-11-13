package chorong.recommend.dto;

import java.math.BigDecimal;
import java.util.List;

import chorong.product.dto.ProductSummaryDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 맞춤 추천 결과 1줄 (LOAN-01, 02)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecommendItemDTO {
	private Integer rankNo;					// 순위 1~30
	private ProductSummaryDTO product;		// 상품 한 줄
	private BigDecimal matchRate;			// 일치도 0~100 % (소수 2자리)
	private BigDecimal estRateMin;			// 예상 금리 (연 %), 금리 없으면 null
	private BigDecimal estRateMax;
	private Boolean rateEstimated;			// 빈 구간을 채운 '추정' 값이면 true
	private Long monthlyPayment;			// 월 상환 (원), 계산 못 하면 null
	private String calcNote;				// 계산 기준 한 줄
	private List<String> judgeTags;			// 판단 태그 3개 (주의 먼저)
	private List<String> reasons;			// 이유 문장 최대 5개
}
