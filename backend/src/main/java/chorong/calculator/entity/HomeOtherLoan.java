package chorong.calculator.entity;

import java.math.BigDecimal;

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
 * home_other_loan 테이블 (집 살 때 대출한도 계산에 넣은 다른 대출 1건 = 1행, 계산 1번에 0건부터 10건)
 * home_id는 연관관계 매핑 없이 Long 칸 / ON DELETE CASCADE가 없어 home_limit_calc_history보다 먼저 지움 (dsr_loan과 같음)
 */
@Entity
@Table(name = "home_other_loan")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class HomeOtherLoan {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "home_other_loan_id")
	private Long homeOtherLoanId;

	@Column(name = "home_id")
	private Long homeId;				// 어느 집 살 때 대출한도 계산의 대출인지

	@Column(name = "sort_no")
	private Integer sortNo;				// 입력한 순서 1-10

	@Enumerated(EnumType.STRING)
	@Column(name = "loan_kind")
	private LoanKind loanKind;

	@Enumerated(EnumType.STRING)
	@Column(name = "repay_method")
	private RepayMethod repayMethod;	// EQUAL_PI, EQUAL_P, BULLET만

	@Column(name = "loan_amount")
	private Long loanAmount;			// 잔액 (원)

	@Column(name = "interest_rate")
	private BigDecimal interestRate;	// 연 %

	@Column(name = "loan_months")
	private Integer loanMonths;			// 남은 기간 (개월)
}
