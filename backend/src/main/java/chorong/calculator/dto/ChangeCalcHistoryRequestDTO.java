package chorong.calculator.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

import chorong.calculator.entity.ChangeCalcHistory;
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
 * 갈아타기 계산 기록 저장 요청 (API-55 POST, CAL-05)
 * 회원 번호 칸은 두지 않음 (세션에서만, B3) / 모르는 코드는 본문 형식 오류로 400
 * GRADUATED는 코드 값으로는 받아지므로 Service에서 막음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChangeCalcHistoryRequestDTO {

	@NotNull
	private RepayMethod currentRepayMethod;	// 지금 대출의 상환 방식

	@NotNull
	@Min(10000)
	@Max(9999999999L)
	private Long currentBalance;			// 지금 대출의 남은 금액 (원), 1만원 이상

	@NotNull
	@DecimalMin("0")
	@DecimalMax("20")
	private BigDecimal currentRate;			// 지금 대출의 연 %, 0-20

	@NotNull
	@Min(1)
	@Max(600)
	private Integer currentMonths;			// 지금 대출의 남은 기간 (개월)

	@NotNull
	private RepayMethod newRepayMethod;		// 갈아탈 대출의 상환 방식

	@NotNull
	@DecimalMin("0")
	@DecimalMax("20")
	private BigDecimal newRate;				// 갈아탈 대출의 연 %, 0-20

	@NotNull
	@Min(1)
	@Max(600)
	private Integer newMonths;				// 갈아탈 대출의 기간 (개월)

	@NotNull
	@DecimalMin("0")
	@DecimalMax("5")
	private BigDecimal feeRate;				// 중도상환수수료율 (%), 0-5

	@NotNull
	@Min(0)
	@Max(9999999999L)
	private Long etcCost;					// 기타 비용 (원)

	@NotNull
	@Min(-999999999999999L)
	@Max(999999999999999L)
	private Long savingAmount;				// 아끼는 돈 (원, 더 내면 음수)

	@NotNull
	@Min(0)
	@Max(999999999999999L)
	private Long newFirstPayment;			// 갈아탈 대출의 첫 달 납부액 (원)

	@NotNull
	@Min(0)
	@Max(999999999999999L)
	private Long newTotalInterest;			// 갈아탈 대출의 총 이자 (원)

	/** 요청 1건 -> 엔티티 (금리는 소수 2자리로 맞춤) */
	public ChangeCalcHistory toEntity(Long memberId, LocalDateTime calcAt) {
		return ChangeCalcHistory.builder()
				.memberId(memberId)
				.currentRepayMethod(currentRepayMethod)
				.currentBalance(currentBalance)
				.currentRate(currentRate.setScale(2, RoundingMode.HALF_UP))
				.currentMonths(currentMonths)
				.newRepayMethod(newRepayMethod)
				.newRate(newRate.setScale(2, RoundingMode.HALF_UP))
				.newMonths(newMonths)
				.feeRate(feeRate.setScale(2, RoundingMode.HALF_UP))
				.etcCost(etcCost)
				.savingAmount(savingAmount)
				.newFirstPayment(newFirstPayment)
				.newTotalInterest(newTotalInterest)
				.calcAt(calcAt)
				.build();
	}
}
