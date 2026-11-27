package chorong.calculator.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.calculator.entity.HomeLimitCalcHistory;
import chorong.calculator.entity.HomeOtherLoan;
import chorong.calculator.entity.HomeRateType;
import chorong.calculator.entity.HomeRegion;
import chorong.calculator.entity.LoanKind;
import chorong.calculator.entity.RepayMethod;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 집 대출한도 계산 기록 목록 (API-58 GET, CAL-08)
 * rateType은 예전 기록이면 null, otherLoans는 입력 순서대로 (없으면 빈 목록)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HomeLimitCalcHistoryResponseDTO {
	private List<Item> items;			// 최신 기록 먼저

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class Item {
		private Long homeId;
		private Long housePrice;			// 원
		private HomeRegion homeRegion;
		private String firstHome;			// 'Y', 'N'
		private Long annualIncome;			// 원
		private Long otherInterest;			// 원
		private BigDecimal interestRate;	// 연 %
		private Integer loanYears;
		private RepayMethod repayMethod;
		private Long maxLoan;				// 원
		private Long ltvLimit;				// 원
		private Long dtiLimit;				// 원 (소득 기준 한도)
		private HomeRateType rateType;		// 예전 기록은 null
		private List<OtherLoanItem> otherLoans;	// 입력 순서대로
		@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
		private LocalDateTime calcAt;

		public static Item from(HomeLimitCalcHistory calc, List<HomeOtherLoan> loans) {
			List<OtherLoanItem> loanItems = loans.stream().map(OtherLoanItem::from).toList();
			return new Item(calc.getHomeId(), calc.getHousePrice(), calc.getHomeRegion(), calc.getFirstHome(),
					calc.getAnnualIncome(), calc.getOtherInterest(), calc.getInterestRate(), calc.getLoanYears(),
					calc.getRepayMethod(), calc.getMaxLoan(), calc.getLtvLimit(), calc.getDtiLimit(), calc.getRateType(),
					loanItems, calc.getCalcAt());
		}
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class OtherLoanItem {
		private LoanKind loanKind;
		private RepayMethod repayMethod;
		private Long loanAmount;			// 원 (잔액)
		private BigDecimal interestRate;	// 연 %
		private Integer loanMonths;			// 남은 기간 (개월)

		public static OtherLoanItem from(HomeOtherLoan loan) {
			return new OtherLoanItem(loan.getLoanKind(), loan.getRepayMethod(), loan.getLoanAmount(),
					loan.getInterestRate(), loan.getLoanMonths());
		}
	}
}
