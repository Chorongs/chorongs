package chorong.report.entity;

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
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
 * loan_report 테이블 (대출 상품 신고)
 * 신고자(memberId)는 관리자 화면에만, 일반 이용자 API에는 내리지 않음
 * CHORONG-57(관리자 현황, 이력 개수)에서 먼저 만듦 / 신고 저장, 처리 메서드는 CHORONG-50에서 추가
 */
@Entity
@Table(name = "loan_report")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class LoanReport {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "report_id")
	private Long reportId;

	@Column(name = "product_id")
	private Long productId;

	@Column(name = "member_id")
	private Long memberId;				// 신고한 회원 (관리자만 봄)

	@Column(name = "report_key")
	private String reportKey;			// HMAC-SHA256 16진수 64자, unique(report_key, product_id)

	@Enumerated(EnumType.STRING)
	@Column(name = "report_type")
	private ReportType reportType;

	@Column(name = "content")
	private String content;				// 기타(ETC)만 필수

	@Enumerated(EnumType.STRING)
	@Column(name = "report_status")
	private ReportStatus reportStatus;	// RECEIVED 미처리, DONE 완료

	@Enumerated(EnumType.STRING)
	@Column(name = "report_result")
	private ReportResult reportResult;	// DONE이면 필수

	@Column(name = "handled_by")
	private Long handledBy;				// 처리한 관리자

	@Column(name = "admin_memo")
	private String adminMemo;			// 관리자끼리만

	@Column(name = "created_at")
	private LocalDateTime createdAt;

	@Column(name = "handled_at")
	private LocalDateTime handledAt;
}
