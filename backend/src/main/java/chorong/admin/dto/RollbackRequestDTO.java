package chorong.admin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 되돌리기 (ADMIN-05, API-36)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RollbackRequestDTO {

	@NotNull
	private Long historyId;		// 되돌릴 대상 이력 번호 (이 시점으로)

	/*
	 * 기준 버전 (baseVersion) = 상품 목록의 버전 번호 = 지금 마지막 반영 이력 번호 (product_update_history.history_id 최댓값)
	 * 반영, 되돌리기, 자동 내림, 숨기기처럼 상품이 바뀔 때마다 이력이 1건 생겨 번호가 커짐
	 * 화면이 '내가 보고 결정한 시점의 번호'를 보내면 FastAPI가 지금 번호와 비교 → 다르면 409 VERSION_CONFLICT
	 * (그 사이 다른 관리자나 자동 작업이 상품을 바꿨으니, 바뀐 상태를 다시 보고 결정하라는 뜻)
	 * 여기 값 = 되돌리기 미리보기 응답(RollbackPreviewResponseDTO)의 baseVersion 그대로
	 */
	@NotNull
	private Long baseVersion;
}
