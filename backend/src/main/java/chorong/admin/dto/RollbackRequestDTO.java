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

	@NotNull
	private Long baseVersion;	// 기준 버전 (이력 목록을 받을 때의 현재 버전)
}
