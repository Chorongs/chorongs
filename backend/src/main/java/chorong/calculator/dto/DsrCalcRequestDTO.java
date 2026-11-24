package chorong.calculator.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.IntStream;

import chorong.calculator.entity.DsrCalcHistory;
import chorong.calculator.entity.DsrLoan;
import chorong.calculator.entity.LoanKind;
import chorong.calculator.entity.RepayMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * DSR 계산 기록 저장 요청 (API-56 POST, CAL-06)
 * 회원 번호 칸은 두지 않음 (세션에서만, B3) / 모르는 코드는 본문 형식 오류로 400
 * loans는 1건부터 10건 (0건, 11건 이상은 400)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DsrCalcRequestDTO {

	@NotNull
	@Min(10000)
	@Max(9999999999L)
	private Long annualIncome;			// 연소득 (원), 1만원 이상

	@NotNull
	@DecimalMin("0")
	@DecimalMax("99999999999.99")
	private BigDecimal dsrRate;			// DSR 결과 (%)

	@NotNull
	@Min(0)
	@Max(999999999999999L)
	private Long yearlyPayment;			// 1년간 갚는 원리금 합계 (원)

	@NotNull
	@Size(min = 1, max = 10)
	private List<@NotNull @Valid LoanItem> loans;	// 입력 순서대로

	/** 요청 1건 -> 계산 엔티티 (DSR 결과는 소수 2자리로 맞춤) */
	public DsrCalcHistory toEntity(Long memberId, LocalDateTime calcAt) {
		return DsrCalcHistory.builder()
				.memberId(memberId)
				.annualIncome(annualIncome)
				.dsrRate(dsrRate.setScale(2, RoundingMode.HALF_UP))
				.yearlyPayment(yearlyPayment)
				.calcAt(calcAt)
				.build();
	}

	/** 대출 목록 -> 대출 엔티티 목록 (입력 순서대로 1부터 번호를 붙임) */
	public List<DsrLoan> toLoanEntities(Long dsrId) {
		return IntStream.range(0, loans.size())
				.mapToObj(i -> loans.get(i).toEntity(dsrId, i + 1))
				.toList();
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class LoanItem {

		@NotNull
		private LoanKind loanKind;

		@NotNull
		private RepayMethod repayMethod;	// EQUAL_PI, EQUAL_P, BULLET (GRADUATED는 Service에서 막음)

		@NotNull
		@Min(10000)
		@Max(9999999999L)
		private Long loanAmount;			// 대출금액 (원), 1만원 이상

		@NotNull
		@DecimalMin("0")
		@DecimalMax("20")
		private BigDecimal interestRate;	// 연 %, 0-20

		@NotNull
		@Min(1)
		@Max(600)
		private Integer loanMonths;			// 대출기간 (개월)

		DsrLoan toEntity(Long dsrId, int sortNo) {
			return DsrLoan.builder()
					.dsrId(dsrId)
					.sortNo(sortNo)
					.loanKind(loanKind)
					.repayMethod(repayMethod)
					.loanAmount(loanAmount)
					.interestRate(interestRate.setScale(2, RoundingMode.HALF_UP))
					.loanMonths(loanMonths)
					.build();
		}
	}
}
