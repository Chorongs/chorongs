package chorong.recommend.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import chorong.recommend.entity.RecommendResult;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 추천 결과 저장 요청 (API-38 POST, LOAN-04)
 * 소득, 신용, 예상 금리 칸은 두지 않음 (B8) / 라벨은 서버가 용도, 금액, 기간, 직업으로 만듦
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecommendSaveRequestDTO {

	@NotBlank
	@Pattern(regexp = RecommendRequestDTO.PURPOSE_PATTERN)
	private String purpose;				// 자금 용도

	@NotNull
	@Min(10)
	@Max(100000)
	private Integer need;				// 필요 금액 (만원)

	@NotNull
	private Integer months;				// 갚을 기간 (개월), 모름 0

	@NotBlank
	@Pattern(regexp = RecommendRequestDTO.JOB_PATTERN)
	private String job;					// 직업 코드

	@NotNull
	@Size(min = 1, max = 30)
	private List<@NotNull Long> productIds;	// 순위대로 1~30개

	/** 요청 1건 -> 상품마다 1행 (같은 저장 번호, 라벨, 시각 / 순위는 목록 순서) */
	public List<RecommendResult> toEntities(Long saveId, Long memberId, String conditionLabel, LocalDateTime createdAt) {
		List<RecommendResult> rows = new ArrayList<>();
		for (int i = 0; i < productIds.size(); i++) {
			rows.add(RecommendResult.builder()
					.saveId(saveId)
					.memberId(memberId)
					.productId(productIds.get(i))
					.rankNo(i + 1)
					.conditionLabel(conditionLabel)
					.createdAt(createdAt)
					.build());
		}
		return rows;
	}
}
