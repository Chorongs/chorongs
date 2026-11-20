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
 * product_snapshot 테이블 (변경 기록: 그 이력으로 바뀐 상품의 바뀌기 전 값)
 * beforeData는 FastAPI 되돌리기가 그대로 읽는 JSON: 칸 이름은 DB 칸 이름(snake_case), 날짜 글은 'yyyy-MM-dd HH:mm'
 * Spring이 쓰는 기록(상태만 바꾼 것)은 {"product_status": 바뀌기 전 값}, 다시 게시는 disclose_end도
 */
@Entity
@Table(name = "product_snapshot")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class ProductSnapshot {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "snapshot_id")
	private Long snapshotId;

	@Column(name = "history_id")
	private Long historyId;

	@Column(name = "product_id")
	private Long productId;

	@Enumerated(EnumType.STRING)
	@Column(name = "change_type")
	private ChangeType changeType;

	@Lob
	@Column(name = "before_data")
	private String beforeData;			// ADD만 null

	@Enumerated(EnumType.STRING)
	@Column(name = "check_result")
	private CheckResult checkResult;	// 자동 내림 확인용, null = 확인 전

	@Column(name = "checked_by")
	private Long checkedBy;

	@Column(name = "checked_at")
	private LocalDateTime checkedAt;

	/** 자동 내림 확인 기록 (결과, 확인자, 시각은 같이 채움: DB CHECK ck_snapshot_checked) */
	public void check(CheckResult checkResult, Long adminId, LocalDateTime now) {
		this.checkResult = checkResult;
		this.checkedBy = adminId;
		this.checkedAt = now;
	}
}
