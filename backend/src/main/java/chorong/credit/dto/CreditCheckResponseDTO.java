package chorong.credit.dto;

import java.util.List;

import chorong.credit.entity.CreditBand;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/*
 * POST /api/diagnosis/credit 응답 (CREDIT-01)
 * 점수, 항목은 로그에 남기지 않음 (B8)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreditCheckResponseDTO {

	@ToString.Exclude
	private Integer score;				// 예상 점수 1~1000
	private CreditBand creditBand;		// BAND1~5
	@ToString.Exclude
	private List<ItemItem> items;		// 문항별 상태, 팁 (문항 1~10 순서)
	private boolean lowAccuracy;		// '잘 모르겠어요' 답이 있으면 true

	// 문항 1개의 결과
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class ItemItem {
		private Integer questionNo;		// 문항 번호
		private String status;			// 상태 글
		private String tip;				// 팁 문장
	}
}
