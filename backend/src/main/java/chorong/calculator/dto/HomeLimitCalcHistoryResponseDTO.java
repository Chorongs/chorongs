package chorong.calculator.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.calculator.entity.HomeLimitCalcHistory;
import chorong.calculator.entity.HomeRegion;
import chorong.calculator.entity.RepayMethod;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 집 대출한도 계산 기록 목록 (API-58 GET, CAL-08)
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
		private Long dtiLimit;				// 원
		@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
		private LocalDateTime calcAt;

		public static Item from(HomeLimitCalcHistory calc) {
			return new Item(calc.getHomeId(), calc.getHousePrice(), calc.getHomeRegion(), calc.getFirstHome(),
					calc.getAnnualIncome(), calc.getOtherInterest(), calc.getInterestRate(), calc.getLoanYears(),
					calc.getRepayMethod(), calc.getMaxLoan(), calc.getLtvLimit(), calc.getDtiLimit(), calc.getCalcAt());
		}
	}
}
