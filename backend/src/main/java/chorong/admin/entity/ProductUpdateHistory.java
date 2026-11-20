package chorong.admin.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
 * product_update_history 테이블 (반영 이력, history_id = 상품 데이터 버전)
 * Spring이 쓰는 이력: AUTO_CLOSE (BAT-02), SHOW (ADMIN-10 다시 게시), 앞으로 HIDE, SHOW (ADMIN-11, SUE-01) / 나머지는 FastAPI가 씀
 * 이력은 지우거나 고치지 않아 변경 메서드가 없음
 */
@Entity
@Table(name = "product_update_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ProductUpdateHistory {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "history_id")
	private Long historyId;

	@Column(name = "admin_id")
	private Long adminId;				// 처리한 관리자, 자동 작업은 null

	@Enumerated(EnumType.STRING)
	@Column(name = "action_type")
	private ActionType actionType;

	@Column(name = "target_history_id")
	private Long targetHistoryId;		// ROLLBACK만

	@Column(name = "source")
	private String source;				// KINFA, FSS, KINFA,FSS (불러오기 반영만, 나머지 null)

	@Column(name = "added_count")
	private Integer addedCount;

	@Column(name = "changed_count")
	private Integer changedCount;

	@Column(name = "removed_count")
	private Integer removedCount;

	@Column(name = "memo")
	private String memo;

	@Lob
	@Column(name = "count_json")
	private String countJson;			// 불러오기 건수 요약 (FastAPI가 씀)

	@Column(name = "updated_at")
	private LocalDateTime updatedAt;
}
