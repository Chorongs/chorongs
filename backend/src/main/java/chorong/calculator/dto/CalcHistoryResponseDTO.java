package chorong.calculator.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.calculator.entity.CalcHistory;
import chorong.calculator.entity.RepayMethod;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 계산 기록 목록 (API-24 GET, CAL-04)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CalcHistoryResponseDTO {
	private List<Item> items;			// 최신 기록 먼저

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class Item {
		private Long calcId;
		private Long loanAmount;			// 원
		private Integer loanMonths;
		private BigDecimal interestRate;	// 연 %
		private RepayMethod repayMethod;
		private Integer graceMonths;
		private Long totalInterest;			// 원
		private Long firstPayment;			// 원
		@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
		private LocalDateTime calcAt;

		public static Item from(CalcHistory calc) {
			return new Item(calc.getCalcId(), calc.getLoanAmount(), calc.getLoanMonths(), calc.getInterestRate(),
					calc.getRepayMethod(), calc.getGraceMonths(), calc.getTotalInterest(), calc.getFirstPayment(),
					calc.getCalcAt());
		}
	}
}
