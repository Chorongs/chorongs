package chorong.common.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * FastAPI 최신 상품 확인 응답 (EXT-05, ADMIN-04 최신 상품 확인, GET /imports/check)
 * 출처마다 외부 API 첫 쪽만 읽어 DB와 비교한 결과. 적재, 비교 저장은 하지 않음
 * FastAPI JSON은 snake_case라 칸마다 @JsonProperty로 맞춤
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FastApiImportCheckResponseDTO {

	@JsonProperty("checked_at")
	private LocalDateTime checkedAt;		// 확인 시각
	private List<SourceCheck> sources;		// 출처별 결과 (KINFA, FSS 순)
	@JsonProperty("needs_refresh")
	private Boolean needsRefresh;			// 하나라도 isLatest false
	@JsonProperty("pending_job")
	private PendingJob pendingJob;			// 갱신이 끝나고 반영 전인 작업 (없으면 null)

	// 출처 1곳의 최신 여부. 실패한 출처는 error만 채워지고 출처 기준 칸은 null
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class SourceCheck {
		private String source;				// KINFA, FSS
		@JsonProperty("loaded_at")
		private LocalDateTime loadedAt;		// DB 적재 시각 (그 출처를 포함한 마지막 DONE, PUBLISHED 작업의 finished_at, 없으면 첫 적재 INIT 시각)
		@JsonProperty("is_latest")
		private Boolean isLatest;			// 출처 첫 쪽 기준값이 DB와 같은지 (실패면 null)
		@JsonProperty("db_mark")
		private String dbMark;				// DB 기준: 금감원 최신 공시월 / 서민 상품 수
		@JsonProperty("source_mark")
		private String sourceMark;			// 출처 첫 쪽 기준: 금감원 공시월 / 서민 상품 수
		@JsonProperty("new_count")
		private Integer newCount;			// 서민만: 출처에 새로 온 seq 수
		@JsonProperty("missing_count")
		private Integer missingCount;		// 서민만: DB에 있는데 출처에 없는 seq 수
		private String error;				// 실패 사유 (성공이면 null)
	}

	// 갱신이 끝나고 반영 전인 작업 (DONE, 24시간 안)
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class PendingJob {
		@JsonProperty("job_id")
		private Long jobId;
		@JsonProperty("finished_at")
		private LocalDateTime finishedAt;
		@JsonProperty("item_count")
		private Integer itemCount;			// 반영 대기 항목 수
	}
}
