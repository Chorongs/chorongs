package chorong.credit.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.credit.entity.CreditBand;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * GET, PUT /api/me/reports/credit 응답 (CREDIT-02)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DiagnosisReportResponseDTO {

	private CreditBand creditBand;		// BAND1~5

	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime createdAt;	// 진단 시각
}
