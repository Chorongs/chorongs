package chorong.calculator.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.calculator.entity.ChangeCalcHistory;
import chorong.calculator.entity.RepayMethod;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 갈아타기 계산 기록 목록 (API-55 GET, CAL-05)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChangeCalcHistoryResponseDTO {
	private List<Item> items;			// 최신 기록 먼저

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class Item {
		private Long changeId;
		private RepayMethod currentRepayMethod;
		private Long currentBalance;		// 원
		private BigDecimal currentRate;		// 연 %
		private Integer currentMonths;
		private RepayMethod newRepayMethod;
		private BigDecimal newRate;			// 연 %
		private Integer newMonths;
		private BigDecimal feeRate;			// %
		private Long etcCost;				// 원
		private Long savingAmount;			// 원, 더 내면 음수
		private Long newFirstPayment;		// 원
		private Long newTotalInterest;		// 원
		@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
		private LocalDateTime calcAt;

		public static Item from(ChangeCalcHistory calc) {
			return new Item(calc.getChangeId(), calc.getCurrentRepayMethod(), calc.getCurrentBalance(),
					calc.getCurrentRate(), calc.getCurrentMonths(), calc.getNewRepayMethod(), calc.getNewRate(),
					calc.getNewMonths(), calc.getFeeRate(), calc.getEtcCost(), calc.getSavingAmount(),
					calc.getNewFirstPayment(), calc.getNewTotalInterest(), calc.getCalcAt());
		}
	}
}
