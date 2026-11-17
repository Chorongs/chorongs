package chorong.recommend.entity;

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
 * recommend_result 테이블 (저장한 추천 결과: 상품 번호, 순위, 조건 라벨만. 입력값은 저장 안 함)
 * 저장 1번 = 같은 saveId를 가진 여러 행 (최대 30), 회원당 saveId 10개
 */
@Entity
@Table(name = "recommend_result")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
public class RecommendResult {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "result_id")
	private Long resultId;

	@Column(name = "save_id")
	private Long saveId;				// 저장 묶음 번호 (seq_recommend_save)

	@Column(name = "member_id")
	private Long memberId;

	@Column(name = "product_id")
	private Long productId;

	@Column(name = "rank_no")
	private Integer rankNo;				// 1~30

	@Column(name = "condition_label")
	private String conditionLabel;		// 예: 생활비 1,000만원 / 3년 / 직장인

	@Column(name = "created_at")
	private LocalDateTime createdAt;	// 저장 시각 (묶음 안에서 같은 값)
}
