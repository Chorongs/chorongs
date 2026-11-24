package chorong.common.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * FastAPI 갱신 작업 응답 (EXT-05, ADMIN-04)
 * POST /imports 응답은 jobId만 채워짐 / GET /imports/{job_id} 응답은 전부 채워짐
 * FastAPI JSON은 snake_case라 칸마다 @JsonProperty로 맞춤
 * 반영할 상품 값(after_data)은 FastAPI DB(import_item)에만 있고 Spring은 받지 않음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FastApiImportResponseDTO {

	@JsonProperty("job_id")
	private Long jobId;							// 작업 번호
	@JsonProperty("job_status")
	private String jobStatus;					// RUNNING 진행 중, DONE 비교 끝, FAILED 실패, PUBLISHED 반영함, EXPIRED 24시간 지남
	@JsonProperty("base_version")
	private Long baseVersion;					// 비교할 때의 마지막 반영 이력 번호 (반영 요청에 그대로 보냄)
	@JsonProperty("created_at")
	private LocalDateTime createdAt;			// 작업 시작 시각
	@JsonProperty("finished_at")
	private LocalDateTime finishedAt;			// DONE, FAILED가 된 시각 = 반영 대기 테이블 적재 시각 (RUNNING이면 null)
	@JsonProperty("source_results")
	private List<SourceResultItem> sourceResults;	// 출처별 결과
	private List<Item> items;					// 바뀐 상품 (단수 'item' + Item이 겹쳐 Item으로 함)

	// 출처별 결과: success false인 출처의 상품은 판매 중단으로 보지 않음 (ADMIN-04)
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class SourceResultItem {
		private String source;		// KINFA, FSS
		private Boolean success;	// 수집 성공 여부
		private Integer count;		// 정제한 상품 수 (실패면 0)
		private String error;		// 실패 사유 (성공이면 null)
	}

	// 바뀐 상품 1개 (import_item 행)
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class Item {
		@JsonProperty("item_id")
		private Long itemId;				// 항목 번호 (반영 요청의 itemIds)
		@JsonProperty("diff_type")
		private String diffType;			// NEW 신규, CHANGE 변경, REMOVE 판매 중단, REOPEN 다시 게시, CHECK 확인 필요
		@JsonProperty("product_id")
		private Long productId;				// 지금 상품 번호 (NEW는 null)
		@JsonProperty("product_name")
		private String productName;			// 확인 필요 '상품명 없음'은 null
		@JsonProperty("company_name")
		private String companyName;
		private String source;				// KINFA, FSS
		@JsonProperty("changed_fields")
		private List<String> changedFields;	// 바뀐 칸 이름 (칩은 tags, 구간 금리는 rates, 금감원 공시월은 dcls_month)
		@JsonProperty("check_reasons")
		private List<String> checkReasons;	// 확인 필요 사유: NO_NAME, RATE_REVERSED, RATE_OVER_20, NEW_PHRASE (CHECK만)
		@JsonProperty("hidden_yn")
		private String hiddenYn;			// 지금 숨김(HIDDEN) 중이면 Y (반영해도 숨김 유지)
	}
}
