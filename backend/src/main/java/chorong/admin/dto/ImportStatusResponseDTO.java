package chorong.admin.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.common.dto.FastApiImportResponseDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 갱신 시작 (작업 번호만), 진행, 비교 결과, 최근 작업 (ADMIN-04, API-32, 33)
 * FastAPI 응답(FastApiImportResponseDTO, JSON은 snake_case)을 화면용 camelCase로 옮김 / 목록은 복사해 담음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImportStatusResponseDTO {
	private Long jobId;								// 작업 번호
	private String jobStatus;						// RUNNING, DONE, FAILED, PUBLISHED, EXPIRED
	/*
	 * 기준 버전 (baseVersion) = 상품 목록의 버전 번호 = 지금 마지막 반영 이력 번호 (product_update_history.history_id 최댓값)
	 * 반영, 되돌리기, 자동 내림, 숨기기처럼 상품이 바뀔 때마다 이력이 1건 생겨 번호가 커짐
	 * 화면이 '내가 보고 결정한 시점의 번호'를 보내면 FastAPI가 지금 번호와 비교 → 다르면 409 VERSION_CONFLICT
	 * (그 사이 다른 관리자나 자동 작업이 상품을 바꿨으니, 바뀐 상태를 다시 보고 결정하라는 뜻)
	 * 여기 값 = 비교하려고 지금 상품을 읽은 시점의 버전 (import_job.base_version, FastAPI가 DONE 때 씀) → 반영 요청(PublishRequestDTO)에 그대로 보냄
	 */
	private Long baseVersion;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime createdAt;				// 작업 시작 시각
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime finishedAt;				// DONE, FAILED가 된 시각 = DB 적재 시각 (화면 현황 '마지막 갱신', RUNNING이면 null)
	private List<SourceResultItem> sourceResults;	// 출처별 결과
	private List<Item> items;						// 바뀐 상품 (단수 'item' + Item이 겹쳐 Item, FastApiImportResponseDTO와 같음)

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class SourceResultItem {
		private String source;		// KINFA, FSS
		private Boolean success;
		private Integer count;		// 정제한 상품 수
		private String error;		// 실패 사유
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class Item {
		private Long itemId;				// 반영 요청의 itemIds
		private String diffType;			// NEW 신규, CHANGE 변경, REMOVE 판매 중단, REOPEN 다시 게시, CHECK 확인 필요
		private Long productId;				// NEW는 null
		private String productName;
		private String companyName;
		private String source;
		private List<String> changedFields;	// 바뀐 칸 (칩 tags, 구간 금리 rates, 공시월 dcls_month)
		private List<String> checkReasons;	// 확인 필요 사유 (CHECK만): NO_NAME, RATE_REVERSED, RATE_OVER_20, NEW_PHRASE
		private String hiddenYn;			// 숨김 중이면 Y
	}

	public static ImportStatusResponseDTO from(FastApiImportResponseDTO fast) {
		List<SourceResultItem> sourceResults = copyOrEmpty(fast.getSourceResults()).stream()
				.map(r -> new SourceResultItem(r.getSource(), r.getSuccess(), r.getCount(), r.getError()))
				.toList();
		List<Item> items = copyOrEmpty(fast.getItems()).stream()
				.map(i -> new Item(i.getItemId(), i.getDiffType(), i.getProductId(), i.getProductName(),
						i.getCompanyName(), i.getSource(), copyOrEmpty(i.getChangedFields()),
						copyOrEmpty(i.getCheckReasons()), i.getHiddenYn()))
				.toList();
		return new ImportStatusResponseDTO(fast.getJobId(), fast.getJobStatus(), fast.getBaseVersion(),
				fast.getCreatedAt(), fast.getFinishedAt(), sourceResults, items);
	}

	// 받은 목록을 복사해 담음 (원본이 바뀌어도 그대로), 없으면 빈 목록
	private static <T> List<T> copyOrEmpty(List<T> list) {
		return list == null ? List.of() : List.copyOf(list);
	}
}
