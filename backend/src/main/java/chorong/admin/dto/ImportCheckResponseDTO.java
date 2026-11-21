package chorong.admin.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.common.dto.FastApiImportCheckResponseDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 최신 상품 확인 결과 (ADMIN-04 최신 상품 확인, API-55)
 * FastAPI 응답(FastApiImportCheckResponseDTO, JSON은 snake_case)을 화면용 camelCase로 옮김 / 목록은 새 객체로 옮겨 담음
 * 화면: 출처별 카드 (적재 시각, DB 기준, 출처 기준, 최신 여부) + 모두 최신이면 문구 24, 아니면 문구 25, pendingJob이 있으면 '반영을 기다려요'
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImportCheckResponseDTO {
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime checkedAt;		// 확인 시각
	private List<SourceCheck> sources;		// 출처별 결과 (KINFA, FSS 순)
	private Boolean needsRefresh;			// 하나라도 isLatest false → [최신 상품 갱신하기] 안내
	private PendingJob pendingJob;			// 갱신이 끝나고 반영 전인 작업 (없으면 null)

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class SourceCheck {
		private String source;				// KINFA, FSS
		@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
		private LocalDateTime loadedAt;		// DB 적재 시각
		private Boolean isLatest;			// 실패한 출처는 null
		private String dbMark;				// DB 기준: 금감원 최신 공시월 / 서민 상품 수
		private String sourceMark;			// 출처 첫 쪽 기준
		private Integer newCount;			// 서민만: 출처에 새로 온 seq 수
		private Integer missingCount;		// 서민만: 출처에서 빠진 seq 수
		private String error;				// 실패 사유
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class PendingJob {
		private Long jobId;
		@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
		private LocalDateTime finishedAt;
		private Integer itemCount;			// 반영 대기 항목 수
	}

	public static ImportCheckResponseDTO from(FastApiImportCheckResponseDTO fast) {
		List<SourceCheck> sources = (fast.getSources() == null ? List.<FastApiImportCheckResponseDTO.SourceCheck>of()
				: List.copyOf(fast.getSources())).stream()
				.map(s -> new SourceCheck(s.getSource(), s.getLoadedAt(), s.getIsLatest(), s.getDbMark(),
						s.getSourceMark(), s.getNewCount(), s.getMissingCount(), s.getError()))
				.toList();
		FastApiImportCheckResponseDTO.PendingJob job = fast.getPendingJob();
		PendingJob pendingJob = job == null ? null
				: new PendingJob(job.getJobId(), job.getFinishedAt(), job.getItemCount());
		return new ImportCheckResponseDTO(fast.getCheckedAt(), sources, fast.getNeedsRefresh(), pendingJob);
	}
}
