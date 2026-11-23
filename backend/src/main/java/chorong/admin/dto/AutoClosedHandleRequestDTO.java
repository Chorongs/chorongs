package chorong.admin.dto;

import java.util.List;

import chorong.admin.entity.CheckResult;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 자동 내림 확인, 다시 게시 (ADMIN-10, API-48 PATCH) / 번호 목록 최대 100개 (B10)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AutoClosedHandleRequestDTO {

	@NotEmpty
	@Size(max = 100)
	private List<@NotNull Long> productIds;

	@NotNull
	private CheckResult action;	// KEEP 확인, REOPEN 다시 게시
}
