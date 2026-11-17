package chorong.credit.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/*
 * POST /api/diagnosis/credit 요청 (CREDIT-01)
 * 진단 입력값이라 toString 로그에 남기지 않음 (B8)
 * 문항마다 허용하는 보기 번호는 Service에서 확인 (문항마다 달라서 표시로 못 함, B2)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreditCheckRequestDTO {

	@NotNull
	@Size(max = 10)
	@Valid
	@ToString.Exclude
	private List<AnswerItem> answers;	// 문항 1~10 답 (문항 5는 없어도 됨)

	// 문항 1개의 답: 보기 번호 목록 (문항 5 외에는 1개, '잘 모르겠어요' = [0], 문항 5 대출 없음 = [])
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class AnswerItem {
		@NotNull
		@Min(1)
		@Max(10)
		private Integer questionNo;		// 문항 번호 1~10

		@NotNull
		@Size(max = 4)
		@ToString.Exclude
		private List<@NotNull @Min(0) @Max(6) Integer> choices;
	}
}
