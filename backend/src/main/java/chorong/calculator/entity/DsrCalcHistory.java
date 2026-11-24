package chorong.calculator.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * dsr_calc_history 테이블 (DSR 계산 기록, 회원당 최근 10개, 계산 1번 = 1행)
 * 넣은 대출 목록은 dsr_loan / 지울 때 dsr_loan을 먼저 지움 / 금액 칸은 원 단위
 */
@Entity
@Table(name = "dsr_calc_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class DsrCalcHistory {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "dsr_id")
	private Long dsrId;

	@Column(name = "member_id")
	private Long memberId;

	@Column(name = "annual_income")
	private Long annualIncome;			// 연소득 (원)

	@Column(name = "dsr_rate")
	private BigDecimal dsrRate;			// DSR 결과 (%)

	@Column(name = "yearly_payment")
	private Long yearlyPayment;			// 1년간 갚는 원리금 합계 (원)

	@Column(name = "calc_at")
	private LocalDateTime calcAt;		// 계산 시각
}
