package chorong.report.entity;

/*
 * loan_report.report_type 코드 값 (DB 값 그대로)
 */
public enum ReportType {
	RATE_ERROR,		// 금리 오류
	LIMIT_ERROR,	// 한도 오류
	DISCONTINUED,	// 판매 중단
	CONDITION,		// 조건 불일치
	ILLEGAL_AD,		// 불법, 과장 광고
	ETC				// 기타
}
