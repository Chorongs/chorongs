package chorong.calculator.entity;

/*
 * home_limit_calc_history.rate_type 코드 값 (DB 값 그대로)
 * VARIABLE 변동형 / MIXED 혼합형 / FIXED 고정형 (스트레스 금리 가산값은 화면이 정하고 저장하지 않음)
 */
public enum HomeRateType {
	VARIABLE,
	MIXED,
	FIXED
}
