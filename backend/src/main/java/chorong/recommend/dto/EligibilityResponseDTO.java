package chorong.recommend.dto;

import java.math.BigDecimal;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 조건 판정 응답 (API-44, LOAN-05)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EligibilityResponseDTO {
	private String result;					// PASS 충족 / WARN 주의 / FAIL 미충족
	private List<String> reasons;			// 이유 문장 최대 5개 (FAIL이면 그 제외 사유)
	private BigDecimal estRateMin;			// 예상 금리 (연 %)
	private BigDecimal estRateMax;
	private Boolean rateEstimated;			// 추정 값이면 true
	private Long monthlyPayment;			// 월 상환 (원)
	private String calcNote;				// 계산 기준 한 줄
}
