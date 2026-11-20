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
 * calc_history 테이블 (이자 계산 기록, 회원당 최근 10개)
 * 기본 입력값과 결과만 저장 (중도상환, 금리 변동은 저장 안 함) / 금액 칸은 원 단위
 */
@Entity
@Table(name = "calc_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class CalcHistory {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "calc_id")
	private Long calcId;

	@Column(name = "member_id")
	private Long memberId;

	@Column(name = "loan_amount")
	private Long loanAmount;			// 대출금액 (원)

	@Column(name = "loan_months")
	private Integer loanMonths;			// 대출기간 (개월)

	@Column(name = "interest_rate")
	private BigDecimal interestRate;	// 연 %

	@Enumerated(EnumType.STRING)
	@Column(name = "repay_method")
	private RepayMethod repayMethod;

	@Column(name = "grace_months")
	private Integer graceMonths;		// 거치기간 (개월), 기본 0

	@Column(name = "total_interest")
	private Long totalInterest;			// 총 이자 (원)

	@Column(name = "first_payment")
	private Long firstPayment;			// 첫 달 납부액 (원)

	@Column(name = "calc_at")
	private LocalDateTime calcAt;		// 계산 시각
}
