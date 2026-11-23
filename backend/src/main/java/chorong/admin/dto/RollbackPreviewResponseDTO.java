package chorong.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 되돌리기 미리보기 (ADMIN-05, 확인 창 문구 15 '이 시점 이후 n건이 취소돼요, 상품 m개가 바뀌어요' + 미처리 신고 안내)
 * 이력 목록에서 줄마다 세지 않고, 확인 창을 열 때 한 번만 셈 (그 순간의 최신 숫자)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RollbackPreviewResponseDTO {
	private Long historyId;				// 되돌릴 대상 이력 번호 (이 시점으로)

	/*
	 * 기준 버전 (baseVersion) = 상품 목록의 버전 번호 = 지금 마지막 반영 이력 번호 (product_update_history.history_id 최댓값)
	 * 반영, 되돌리기, 자동 내림, 숨기기처럼 상품이 바뀔 때마다 이력이 1건 생겨 번호가 커짐
	 * 화면이 '내가 보고 결정한 시점의 번호'를 보내면 FastAPI가 지금 번호와 비교 → 다르면 409 VERSION_CONFLICT
	 * (그 사이 다른 관리자나 자동 작업이 상품을 바꿨으니, 바뀐 상태를 다시 보고 결정하라는 뜻)
	 * 여기 값 = 아래 숫자를 셀 때의 버전 → 되돌리기 요청(RollbackRequestDTO)에 그대로 보냄 (확인 창 숫자와 실제 되돌리는 기준이 같음)
	 */
	private Long baseVersion;

	private Integer cancelCount;			// 되돌리면 취소되는 이력 수 (문구 15의 n)
	private Integer changedProductCount;	// 되돌리면 바뀌는 상품 수 (문구 15의 m)
	private Integer unhiddenReportCount;	// 되돌리면 숨김이 풀리는 상품의 미처리 신고 건수
}
