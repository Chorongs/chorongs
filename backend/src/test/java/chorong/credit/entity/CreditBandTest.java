package chorong.credit.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/*
 * 예상 점수 -> 구간 계산 (CREDIT-01): 경계값 확인
 * BAND1 900 초과 / BAND2 801~900 / BAND3 701~800 / BAND4 601~700 / BAND5 600 이하
 */
class CreditBandTest {

	@ParameterizedTest
	@CsvSource({
		"1000, BAND1", "901, BAND1",
		"900, BAND2", "801, BAND2",
		"800, BAND3", "701, BAND3",
		"700, BAND4", "601, BAND4",
		"600, BAND5", "1, BAND5"
	})
	void 점수에_맞는_구간을_돌려준다(int score, CreditBand expected) {
		// Given: 점수 (매개변수)

		// When
		CreditBand band = CreditBand.fromScore(score);

		// Then
		assertEquals(expected, band);
	}
}
