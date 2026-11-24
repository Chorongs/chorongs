package chorong.calculator.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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
 * reverse_calc_history 테이블 (상환능력 기반 대출 계산 기록, 회원당 최근 10개)
 * 입력값과 최대 대출 금액만 저장 (기간별 금액 표는 저장 안 함) / 금액 칸은 원 단위
 */
@Entity
@Table(name = "reverse_calc_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class ReverseCalcHistory {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "reverse_id")
	private Long reverseId;

	@Column(name = "member_id")
	private Long memberId;

	@Enumerated(EnumType.STRING)
	@Column(name = "repay_method")
	private RepayMethod repayMethod;

	@Column(name = "monthly_payment")
	private Long monthlyPayment;		// 매달 갚을 수 있는 돈 (원)

	@Column(name = "interest_rate")
	private BigDecimal interestRate;	// 연 %

	@Column(name = "loan_months")
	private Integer loanMonths;			// 대출기간 (개월)

	@Column(name = "max_loan")
	private Long maxLoan;				// 빌릴 수 있는 최대 금액 (원)

	@Column(name = "calc_at")
	private LocalDateTime calcAt;		// 계산 시각
}
