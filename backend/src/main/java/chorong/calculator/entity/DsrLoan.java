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
 * dsr_loan 테이블 (DSR 계산에 넣은 대출 1건 = 1행, 계산 1번에 1건부터 10건)
 * dsr_id는 연관관계 매핑 없이 Long 칸 / ON DELETE CASCADE가 없어 dsr_calc_history보다 먼저 지움
 */
@Entity
@Table(name = "dsr_loan")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class DsrLoan {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "dsr_loan_id")
	private Long dsrLoanId;

	@Column(name = "dsr_id")
	private Long dsrId;					// 어느 DSR 계산의 대출인지

	@Column(name = "sort_no")
	private Integer sortNo;				// 입력한 순서 1-10

	@Enumerated(EnumType.STRING)
	@Column(name = "loan_kind")
	private LoanKind loanKind;

	@Enumerated(EnumType.STRING)
	@Column(name = "repay_method")
	private RepayMethod repayMethod;

	@Column(name = "loan_amount")
	private Long loanAmount;			// 대출금액 (원)

	@Column(name = "interest_rate")
	private BigDecimal interestRate;	// 연 %

	@Column(name = "loan_months")
	private Integer loanMonths;			// 대출기간 (개월)
}
