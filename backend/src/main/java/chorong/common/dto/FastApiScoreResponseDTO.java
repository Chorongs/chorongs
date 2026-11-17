package chorong.common.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/*
 * FastAPI POST /credit/score 응답 (EXT-05, 예상 점수 + 문항별 점수)
 * 점수는 로그에 남기지 않음 (B8) / 구간(BAND1~5)은 Spring이 정함 (CREDIT-01)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FastApiScoreResponseDTO {

	@ToString.Exclude
	private Integer score;						// 예상 점수 1~1000
	@ToString.Exclude
	@JsonProperty("item_scores")
	private List<ItemScoreItem> itemScores;		// 문항별 점수

	// 문항 1개의 점수
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class ItemScoreItem {
		@JsonProperty("question_no")
		private Integer questionNo;
		@ToString.Exclude
		private Integer score;
	}
}
