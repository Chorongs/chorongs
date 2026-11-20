package chorong.admin.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.admin.entity.ActionType;
import chorong.admin.entity.ProductUpdateHistory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 반영 이력 1줄 (ADMIN-05, API-35)
 * 처리자: adminId null = 자동 작업, adminId는 있는데 adminName null = 탈퇴한 관리자 (화면 글자는 프론트)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HistoryResponseDTO {
	private Long historyId;				// 이력 번호 = 버전
	private Long adminId;
	private String adminName;
	private ActionType actionType;		// INIT, PUBLISH, AUTO_CLOSE, HIDE, SHOW, ROLLBACK
	private Long targetHistoryId;		// ROLLBACK만
	private String source;				// 불러오기 반영만
	private Integer addedCount;
	private Integer changedCount;
	private Integer removedCount;
	private String memo;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime updatedAt;
	private Boolean canRollback;			// 이 시점으로 되돌릴 수 있는지 (지금 마지막 이력은 false)
	private Integer cancelCount;			// 되돌리면 취소되는 이력 수 (상세 기획 문구 15의 n)
	private Integer changedProductCount;	// 되돌리면 바뀌는 상품 수 (문구 15의 m)
	private Integer unhiddenReportCount;	// 되돌리면 숨김이 풀리는 상품의 미처리 신고 건수

	/** 이력 행 + 처리자 이름 (되돌리기 값은 서비스가 채움) */
	public static HistoryResponseDTO from(ProductUpdateHistory history, String adminName) {
		return HistoryResponseDTO.builder()
				.historyId(history.getHistoryId())
				.adminId(history.getAdminId())
				.adminName(adminName)
				.actionType(history.getActionType())
				.targetHistoryId(history.getTargetHistoryId())
				.source(history.getSource())
				.addedCount(history.getAddedCount())
				.changedCount(history.getChangedCount())
				.removedCount(history.getRemovedCount())
				.memo(history.getMemo())
				.updatedAt(history.getUpdatedAt())
				.build();
	}
}
