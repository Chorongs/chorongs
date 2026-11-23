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
 * change_calc_history 테이블 (갈아타기 계산 기록, 회원당 최근 10개)
 * 입력값과 화면이 계산한 결과를 그대로 저장 / 금액 칸은 원 단위
 */
@Entity
@Table(name = "change_calc_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class ChangeCalcHistory {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "change_id")
	private Long changeId;

	@Column(name = "member_id")
	private Long memberId;

	@Enumerated(EnumType.STRING)
	@Column(name = "current_repay_method")
	private RepayMethod currentRepayMethod;	// 지금 대출의 상환 방식

	@Column(name = "current_balance")
	private Long currentBalance;			// 지금 대출의 남은 금액 (원)

	@Column(name = "current_rate")
	private BigDecimal currentRate;			// 지금 대출의 연 %

	@Column(name = "current_months")
	private Integer currentMonths;			// 지금 대출의 남은 기간 (개월)

	@Enumerated(EnumType.STRING)
	@Column(name = "new_repay_method")
	private RepayMethod newRepayMethod;		// 갈아탈 대출의 상환 방식

	@Column(name = "new_rate")
	private BigDecimal newRate;				// 갈아탈 대출의 연 %

	@Column(name = "new_months")
	private Integer newMonths;				// 갈아탈 대출의 기간 (개월)

	@Column(name = "fee_rate")
	private BigDecimal feeRate;				// 중도상환수수료율 (%)

	@Column(name = "etc_cost")
	private Long etcCost;					// 기타 비용 (원)

	@Column(name = "saving_amount")
	private Long savingAmount;				// 아끼는 돈 (원, 더 내면 음수)

	@Column(name = "new_first_payment")
	private Long newFirstPayment;			// 갈아탈 대출의 첫 달 납부액 (원)

	@Column(name = "new_total_interest")
	private Long newTotalInterest;			// 갈아탈 대출의 총 이자 (원)

	@Column(name = "calc_at")
	private LocalDateTime calcAt;			// 계산 시각
}
