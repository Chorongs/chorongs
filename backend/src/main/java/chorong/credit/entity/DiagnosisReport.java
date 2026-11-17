package chorong.credit.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
 * diagnosis_report 테이블 (신용 진단 최신 결과, 회원당 1개)
 * 점수, 답 칸 없음 (구간 + 시각만, B8) / unique(member_id)
 * 값은 생성자, 변경 메서드로만 바꿈 (@Setter 안 씀)
 */
@Entity
@Table(name = "diagnosis_report")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DiagnosisReport {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "report_id")
	private Long reportId;

	@Column(name = "member_id")
	private Long memberId;

	@Enumerated(EnumType.STRING)
	@Column(name = "report_type")
	private ReportType reportType;		// CREDIT

	@Enumerated(EnumType.STRING)
	@Column(name = "credit_band")
	private CreditBand creditBand;		// BAND1~5

	@Column(name = "created_at")
	private LocalDateTime createdAt;	// 진단 시각

	public DiagnosisReport(Long memberId, CreditBand creditBand) {
		this.memberId = memberId;
		this.reportType = ReportType.CREDIT;
		this.creditBand = creditBand;
		this.createdAt = LocalDateTime.now();
	}

	/** 다시 저장하면 구간과 시각을 덮어씀 (회원당 1개) */
	public void overwrite(CreditBand creditBand) {
		this.creditBand = creditBand;
		this.createdAt = LocalDateTime.now();
	}
}
