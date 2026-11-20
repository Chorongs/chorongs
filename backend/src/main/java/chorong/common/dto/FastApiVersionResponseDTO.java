package chorong.common.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * FastAPI 반영 (POST /imports/{job_id}/publish), 되돌리기 (POST /catalog/rollback) 응답 (EXT-05, ADMIN-04, 05)
 * version = 새 반영 이력 번호 (product_update_history.history_id) = 새 버전
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FastApiVersionResponseDTO {

	private Long version;	// 새 버전
}
