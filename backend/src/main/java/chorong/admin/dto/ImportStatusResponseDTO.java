package chorong.admin.dto;

import java.util.List;

import chorong.common.dto.FastApiImportResponseDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 불러오기 시작 (작업 번호만), 진행, 비교 결과 (ADMIN-04, API-32, 33)
 * FastAPI 응답(FastApiImportResponseDTO, JSON은 snake_case)을 화면용 camelCase로 옮김 / 목록은 복사해 담음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImportStatusResponseDTO {
	private Long jobId;								// 작업 번호
	private String jobStatus;						// RUNNING, DONE, FAILED, PUBLISHED, EXPIRED
	private Long baseVersion;						// 반영 요청에 그대로 보낼 기준 버전
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
				sourceResults, items);
	}

	// 받은 목록을 복사해 담음 (원본이 바뀌어도 그대로), 없으면 빈 목록
	private static <T> List<T> copyOrEmpty(List<T> list) {
		return list == null ? List.of() : List.copyOf(list);
	}
}
