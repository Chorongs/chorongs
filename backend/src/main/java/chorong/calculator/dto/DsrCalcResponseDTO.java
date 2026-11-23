package chorong.calculator.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.calculator.entity.DsrCalcHistory;
import chorong.calculator.entity.DsrLoan;
import chorong.calculator.entity.LoanKind;
import chorong.calculator.entity.RepayMethod;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 DSR 계산 기록 목록 (API-56 GET, CAL-06)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DsrCalcResponseDTO {
	private List<Item> items;			// 최신 기록 먼저

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class Item {
		private Long dsrId;
		private Long annualIncome;			// 원
		private BigDecimal dsrRate;			// %
		private Long yearlyPayment;			// 원
		private List<LoanItem> loans;		// 입력 순서대로
		@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
		private LocalDateTime calcAt;

		// 계산 1건 + 그 계산의 대출 행들(입력 순서대로 정렬되어 있어야 함)
		public static Item from(DsrCalcHistory calc, List<DsrLoan> loans) {
			List<LoanItem> loanItems = loans.stream().map(LoanItem::from).toList();
			return new Item(calc.getDsrId(), calc.getAnnualIncome(), calc.getDsrRate(), calc.getYearlyPayment(),
					loanItems, calc.getCalcAt());
		}
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class LoanItem {
		private LoanKind loanKind;
		private RepayMethod repayMethod;
		private Long loanAmount;			// 원
		private BigDecimal interestRate;	// 연 %
		private Integer loanMonths;

		public static LoanItem from(DsrLoan loan) {
			return new LoanItem(loan.getLoanKind(), loan.getRepayMethod(), loan.getLoanAmount(),
					loan.getInterestRate(), loan.getLoanMonths());
		}
	}
}
