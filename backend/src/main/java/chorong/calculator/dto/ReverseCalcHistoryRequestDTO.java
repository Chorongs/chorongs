package chorong.calculator.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

import chorong.calculator.entity.RepayMethod;
import chorong.calculator.entity.ReverseCalcHistory;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 상환능력 기반 대출 계산 기록 저장 요청 (API-57 POST, CAL-07)
 * 회원 번호 칸은 두지 않음 (세션에서만, B3) / 모르는 코드는 본문 형식 오류로 400
 * GRADUATED는 코드 값으로는 받아지므로 Service에서 막음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReverseCalcHistoryRequestDTO {

	@NotNull
	private RepayMethod repayMethod;

	@NotNull
	@Min(10000)
	@Max(9999999999L)
	private Long monthlyPayment;		// 매달 갚을 수 있는 돈 (원), 1만원 이상

	@NotNull
	@DecimalMin("0")
	@DecimalMax("20")
	private BigDecimal interestRate;	// 연 %, 0-20

	@NotNull
	@Min(1)
	@Max(600)
	private Integer loanMonths;			// 대출기간 (개월)

	@NotNull
	@Min(0)
	@Max(999999999999999L)
	private Long maxLoan;				// 최대 대출 금액 (원)

	/** 요청 1건 -> 엔티티 (금리는 소수 2자리로 맞춤) */
	public ReverseCalcHistory toEntity(Long memberId, LocalDateTime calcAt) {
		return ReverseCalcHistory.builder()
				.memberId(memberId)
				.repayMethod(repayMethod)
				.monthlyPayment(monthlyPayment)
				.interestRate(interestRate.setScale(2, RoundingMode.HALF_UP))
				.loanMonths(loanMonths)
				.maxLoan(maxLoan)
				.calcAt(calcAt)
				.build();
	}
}
