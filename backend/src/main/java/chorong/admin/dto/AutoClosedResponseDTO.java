package chorong.admin.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.admin.entity.CheckResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 자동 내림 확인 목록 1줄 (ADMIN-10, API-48)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AutoClosedResponseDTO {
	private Long productId;
	private String productName;
	private String companyName;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime discloseEnd;	// 공시 종료일 (다시 게시하면 비워져 null)
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime closedAt;		// 내린 날 (자동 내림 이력 시각)
	private CheckResult checkResult;	// null 확인 전, KEEP 확인함, REOPEN 다시 게시함
}
