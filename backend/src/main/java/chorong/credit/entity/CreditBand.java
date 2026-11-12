package chorong.credit.entity;

/*
 * diagnosis_report.credit_band 코드 값 (DB 값 그대로)
 * BAND1 900 초과 / BAND2 801~900 / BAND3 701~800 / BAND4 601~700 / BAND5 600 이하
 */
public enum CreditBand {
	BAND1,
	BAND2,
	BAND3,
	BAND4,
	BAND5;

	/** 예상 점수 (1~1000) -> 구간 (CREDIT-01 처리 순서 3) */
	public static CreditBand fromScore(int score) {
		if (score > 900) return BAND1;
		if (score > 800) return BAND2;
		if (score > 700) return BAND3;
		if (score > 600) return BAND4;
		return BAND5;
	}
}
