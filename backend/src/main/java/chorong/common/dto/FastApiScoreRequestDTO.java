package chorong.common.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/*
 * FastAPI POST /credit/score 요청 (EXT-05, 신용 진단 문항 답)
 * 진단 입력값이라 toString 로그에 남기지 않음 (B8)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FastApiScoreRequestDTO {

	@ToString.Exclude
	private List<AnswerItem> answers;	// 문항 1~10 답

	// 문항 1개의 답: 보기 번호 목록 ('잘 모르겠어요' = [0], 문항 5 대출 없음 = [])
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class AnswerItem {
		@JsonProperty("question_no")
		private Integer questionNo;
		@ToString.Exclude
		private List<Integer> choices;
	}
}
