package chorong.calculator.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
 * home_limit_calc_history 테이블 (내 집 대출한도 계산 기록, 회원당 최근 10개)
 * 입력값과 계산한 한도 3개만 저장 (LTV, DTI 비율은 화면의 예시 값이라 저장 안 함) / 금액 칸은 원 단위
 */
@Entity
@Table(name = "home_limit_calc_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class HomeLimitCalcHistory {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "home_id")
	private Long homeId;

	@Column(name = "member_id")
	private Long memberId;

	@Column(name = "house_price")
	private Long housePrice;			// 집값 (원)

	@Enumerated(EnumType.STRING)
	@Column(name = "home_region")
	private HomeRegion homeRegion;

	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(name = "first_home", length = 1)
	private String firstHome;			// 'Y' 생애 최초 주택 구입, 'N' 아님

	@Column(name = "annual_income")
	private Long annualIncome;			// 연소득 (원)

	@Column(name = "other_interest")
	private Long otherInterest;			// 다른 대출의 1년 이자 (원)

	@Column(name = "interest_rate")
	private BigDecimal interestRate;	// 연 %

	@Column(name = "loan_years")
	private Integer loanYears;			// 대출기간 (년)

	@Enumerated(EnumType.STRING)
	@Column(name = "repay_method")
	private RepayMethod repayMethod;	// EQUAL_PI, EQUAL_P만

	@Enumerated(EnumType.STRING)
	@Column(name = "rate_type")
	private HomeRateType rateType;		// 금리 유형 (예전 기록은 null)

	@Column(name = "max_loan")
	private Long maxLoan;				// 최대 대출 한도 (원)

	@Column(name = "ltv_limit")
	private Long ltvLimit;				// LTV 기준 한도 (원)

	@Column(name = "dti_limit")
	private Long dtiLimit;				// DTI 기준 한도 (원)

	@Column(name = "calc_at")
	private LocalDateTime calcAt;		// 계산 시각
}
