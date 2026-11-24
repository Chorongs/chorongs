package chorong.calculator.entity;

/*
 * calc_history.repay_method 코드 값 (DB 값 그대로)
 * EQUAL_PI 원리금균등 / EQUAL_P 원금균등 / BULLET 만기일시 / GRADUATED 체증식
 */
public enum RepayMethod {
	EQUAL_PI,
	EQUAL_P,
	BULLET,
	GRADUATED
}
