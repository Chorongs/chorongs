package chorong.calculator.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

import chorong.calculator.entity.CalcHistory;
import chorong.calculator.entity.PrepayMode;
import chorong.calculator.entity.RepayMethod;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 계산 기록 저장 요청 (API-24 POST, CAL-04)
 * 회원 번호 칸은 두지 않음 (세션에서만, B3) / 대출 기간(1-600개월)은 Service에서 확인
 * 모르는 상환 방식 코드는 본문 형식 오류로 400
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CalcHistoryRequestDTO {

	@NotNull
	@Min(10000)
	@Max(9999999999L)
	private Long loanAmount;			// 대출금액 (원), 1만원 이상

	@NotNull
	private Integer loanMonths;			// 대출기간 (개월)

	@NotNull
	@DecimalMin("0")
	@DecimalMax("20")
	private BigDecimal interestRate;	// 연 %, 0~20

	@NotNull
	private RepayMethod repayMethod;

	@NotNull
	@Min(0)
	@Max(9999)
	private Integer graceMonths;		// 거치기간 (개월)

	@NotNull
	@Min(0)
	@Max(999999999999999L)
	private Long totalInterest;			// 총 이자 (원)

	@NotNull
	@Min(0)
	@Max(999999999999999L)
	private Long firstPayment;			// 첫 달 납부액 (원)

	// 아래 7칸은 옵션을 안 썼으면 빼거나 null (칸 사이 규칙은 Service에서 확인)
	@DecimalMin("0")
	@DecimalMax("20")
	private BigDecimal growthRate;		// 체증식 연 증가율 (%), 체증식만

	@Min(1)
	@Max(9999)
	private Integer prepayRound;		// 중도상환 회차

	@Min(10000)
	@Max(9999999999L)
	private Long prepayAmount;			// 중도상환액 (원), 1만원 이상

	@DecimalMin("0")
	@DecimalMax("5")
	private BigDecimal prepayFeeRate;	// 중도상환수수료율 (%), 0-5

	private PrepayMode prepayMode;		// 모르는 코드는 본문 형식 오류로 400

	@Min(1)
	@Max(9999)
	private Integer changeRound;		// 금리 변동 회차

	@DecimalMin("0")
	@DecimalMax("20")
	private BigDecimal changeRate;		// 변동 후 연 금리 (%), 0-20

	/** 요청 1건 -> 엔티티 (금리는 소수 2자리로 맞춤) */
	public CalcHistory toEntity(Long memberId, LocalDateTime calcAt) {
		return CalcHistory.builder()
				.memberId(memberId)
				.loanAmount(loanAmount)
				.loanMonths(loanMonths)
				.interestRate(interestRate.setScale(2, RoundingMode.HALF_UP))
				.repayMethod(repayMethod)
				.graceMonths(graceMonths)
				.totalInterest(totalInterest)
				.firstPayment(firstPayment)
				.growthRate(scale(growthRate))
				.prepayRound(prepayRound)
				.prepayAmount(prepayAmount)
				.prepayFeeRate(scale(prepayFeeRate))
				.prepayMode(prepayMode)
				.changeRound(changeRound)
				.changeRate(scale(changeRate))
				.calcAt(calcAt)
				.build();
	}

	// 금리 칸은 DB NUMBER(5,2)라 소수 2자리로 반올림 (없으면 null 그대로)
	private static BigDecimal scale(BigDecimal rate) {
		return rate == null ? null : rate.setScale(2, RoundingMode.HALF_UP);
	}
}
