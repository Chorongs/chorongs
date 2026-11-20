package chorong.credit.dto;

import chorong.credit.entity.CreditBand;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * PUT /api/me/reports/credit 요청 (CREDIT-02)
 * 구간 코드만 받음 (점수, 답, 회원 번호는 받지 않음 - B8, B3)
 * BAND1~5 밖의 값은 enum 변환에 실패해 400 (B2)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DiagnosisReportRequestDTO {

	@NotNull
	private CreditBand creditBand;	// BAND1~5
}
