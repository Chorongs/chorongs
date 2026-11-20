package chorong.calculator.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

import chorong.calculator.entity.CalcHistory;
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
 * 회원 번호 칸은 두지 않음 (세션에서만, B3) / 대출 기간(12, 36, 60, 120, 180)은 Service에서 확인
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
				.calcAt(calcAt)
				.build();
	}
}
