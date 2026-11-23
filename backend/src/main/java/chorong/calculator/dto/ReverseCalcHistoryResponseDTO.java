package chorong.calculator.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.calculator.entity.RepayMethod;
import chorong.calculator.entity.ReverseCalcHistory;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 상환능력 기반 대출 계산 기록 목록 (API-57 GET, CAL-07)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReverseCalcHistoryResponseDTO {
	private List<Item> items;			// 최신 기록 먼저

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class Item {
		private Long reverseId;
		private RepayMethod repayMethod;
		private Long monthlyPayment;		// 원
		private BigDecimal interestRate;	// 연 %
		private Integer loanMonths;
		private Long maxLoan;				// 원
		@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
		private LocalDateTime calcAt;

		public static Item from(ReverseCalcHistory calc) {
			return new Item(calc.getReverseId(), calc.getRepayMethod(), calc.getMonthlyPayment(),
					calc.getInterestRate(), calc.getLoanMonths(), calc.getMaxLoan(), calc.getCalcAt());
		}
	}
}
