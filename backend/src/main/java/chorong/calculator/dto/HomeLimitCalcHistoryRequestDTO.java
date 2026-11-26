package chorong.calculator.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.IntStream;

import chorong.calculator.entity.HomeLimitCalcHistory;
import chorong.calculator.entity.HomeOtherLoan;
import chorong.calculator.entity.HomeRateType;
import chorong.calculator.entity.HomeRegion;
import chorong.calculator.entity.LoanKind;
import chorong.calculator.entity.RepayMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 집 대출한도 계산 기록 저장 요청 (API-58 POST, CAL-08)
 * 회원 번호 칸은 두지 않음 (세션에서만, B3) / 모르는 코드는 본문 형식 오류로 400
 * repayMethod는 EQUAL_PI, EQUAL_P만 (BULLET, GRADUATED는 코드 값으로는 받아지므로 Service에서 막음)
 * rateType 금리 유형, otherLoans 다른 대출 건별 (0건부터 10건, 입력 순서대로, 빼거나 null이면 0건) (2026-11-26 사용자 결정)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HomeLimitCalcHistoryRequestDTO {

	@NotNull
	@Min(10000)
	@Max(9999999999L)
	private Long housePrice;			// 집값 (원), 1만원 이상

	@NotNull
	private HomeRegion homeRegion;

	@NotNull
	@Pattern(regexp = "[YN]")
	private String firstHome;			// 'Y', 'N'

	@NotNull
	@Min(10000)
	@Max(9999999999L)
	private Long annualIncome;			// 연소득 (원), 1만원 이상

	@NotNull
	@Min(0)
	@Max(9999999999L)
	private Long otherInterest;			// 다른 대출의 1년 이자 (원)

	@NotNull
	@DecimalMin("0")
	@DecimalMax("20")
	private BigDecimal interestRate;	// 연 %, 0-20

	@NotNull
	@Min(1)
	@Max(50)
	private Integer loanYears;			// 대출기간 (년)

	@NotNull
	private RepayMethod repayMethod;

	@NotNull
	@Min(0)
	@Max(999999999999999L)
	private Long maxLoan;				// 최대 대출 한도 (원)

	@NotNull
	@Min(0)
	@Max(999999999999999L)
	private Long ltvLimit;				// LTV 기준 한도 (원)

	@NotNull
	@Min(0)
	@Max(999999999999999L)
	private Long dtiLimit;				// 소득 기준 한도 (원). 칸 이름은 dti_limit 그대로, 화면은 DSR 40% 기준 한도를 넣음

	@NotNull
	private HomeRateType rateType;		// 금리 유형 VARIABLE, MIXED, FIXED (모르는 코드는 본문 형식 오류로 400)

	@Size(max = 10)
	private List<@NotNull @Valid OtherLoanItem> otherLoans;	// 다른 대출 (입력 순서대로 0-10건, 건마다 칸 검사)

	/** 요청 1건 -> 엔티티 (금리는 소수 2자리로 맞춤) */
	public HomeLimitCalcHistory toEntity(Long memberId, LocalDateTime calcAt) {
		return HomeLimitCalcHistory.builder()
				.memberId(memberId)
				.housePrice(housePrice)
				.homeRegion(homeRegion)
				.firstHome(firstHome)
				.annualIncome(annualIncome)
				.otherInterest(otherInterest)
				.interestRate(interestRate.setScale(2, RoundingMode.HALF_UP))
				.loanYears(loanYears)
				.repayMethod(repayMethod)
				.rateType(rateType)
				.maxLoan(maxLoan)
				.ltvLimit(ltvLimit)
				.dtiLimit(dtiLimit)
				.calcAt(calcAt)
				.build();
	}

	/** 다른 대출 -> 엔티티 목록 (입력 순서대로 sort_no 1부터, 금리는 소수 2자리로, 없으면 빈 목록) */
	public List<HomeOtherLoan> toOtherLoanEntities(Long homeId) {
		List<OtherLoanItem> items = otherLoans == null ? List.of() : otherLoans;
		return IntStream.range(0, items.size())
				.mapToObj(i -> items.get(i).toEntity(homeId, i + 1))
				.toList();
	}

	/** 다른 대출 1건 */
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class OtherLoanItem {

		@NotNull
		private LoanKind loanKind;

		@NotNull
		private RepayMethod repayMethod;	// EQUAL_PI, EQUAL_P, BULLET (GRADUATED는 Service에서 막음)

		@NotNull
		@Min(1)
		@Max(9999999999L)
		private Long loanAmount;			// 잔액 (원), 화면은 잔액이 있는 건만 보냄

		@NotNull
		@DecimalMin("0")
		@DecimalMax("20")
		private BigDecimal interestRate;	// 연 %, 0-20

		@NotNull
		@Min(1)
		@Max(600)
		private Integer loanMonths;			// 남은 기간 (개월)

		HomeOtherLoan toEntity(Long homeId, int sortNo) {
			return HomeOtherLoan.builder()
					.homeId(homeId)
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
