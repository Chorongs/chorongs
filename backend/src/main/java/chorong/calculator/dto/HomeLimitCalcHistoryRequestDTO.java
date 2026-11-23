package chorong.calculator.dto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

import chorong.calculator.entity.HomeLimitCalcHistory;
import chorong.calculator.entity.HomeRegion;
import chorong.calculator.entity.RepayMethod;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 집 대출한도 계산 기록 저장 요청 (API-58 POST, CAL-08)
 * 회원 번호 칸은 두지 않음 (세션에서만, B3) / 모르는 코드는 본문 형식 오류로 400
 * repayMethod는 EQUAL_PI, EQUAL_P만 (BULLET, GRADUATED는 코드 값으로는 받아지므로 Service에서 막음)
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
	private Long dtiLimit;				// DTI 기준 한도 (원)

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
				.maxLoan(maxLoan)
				.ltvLimit(ltvLimit)
				.dtiLimit(dtiLimit)
				.calcAt(calcAt)
				.build();
	}
}
