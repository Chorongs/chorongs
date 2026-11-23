package chorong.admin.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 확인 후 사이트에 반영 (ADMIN-04, API-34)
 * itemIds는 개수 제한 없음: 반영은 작업마다 한 번(PUBLISHED)이라, 나눠 보내면 나머지를 반영할 수 없음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PublishRequestDTO {

	@NotEmpty
	private List<@NotNull Long> itemIds;	// 고른 바뀐 상품 번호 (확인 필요 CHECK는 넣지 않음, 섞이면 422)

	/*
	 * 기준 버전 (baseVersion) = 상품 목록의 버전 번호 = 지금 마지막 반영 이력 번호 (product_update_history.history_id 최댓값)
	 * 반영, 되돌리기, 자동 내림, 숨기기처럼 상품이 바뀔 때마다 이력이 1건 생겨 번호가 커짐
	 * 화면이 '내가 보고 결정한 시점의 번호'를 보내면 FastAPI가 지금 번호와 비교 → 다르면 409 VERSION_CONFLICT
	 * (그 사이 다른 관리자나 자동 작업이 상품을 바꿨으니, 바뀐 상태를 다시 보고 결정하라는 뜻)
	 * 여기 값 = 진행 확인 응답(ImportStatusResponseDTO)의 baseVersion 그대로 (서버가 DB에서 다시 읽지 않음)
	 */
	@NotNull
	private Long baseVersion;
}
