package chorong.search.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 필터 칩 목록 응답 (SEARCH-03): 필터 8개, 칩 값 순서는 서버 고정 표 (엔티티 시트 Tag 값 목록 순서)
 * 금융권은 세분류 칩(chips) + 대분류 칩(groups, 소속 세분류 값 목록 포함). 대분류는 서버 상수라 DB에 없음
 * 상품 수는 다른 필터와 상관없는 전체 게시 상품 기준, 상품 수 0인 칩은 안 보냄
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FilterChipResponseDTO {

	private List<FilterItem> filters;

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class FilterItem {
		private String key;				// 주소 값 이름 (target, purpose, amount, repay, fin, inst, region, credit)
		private String name;			// 필터 이름 (지원 대상 ...)
		private List<ChipItem> chips;	// 칩 목록
		private List<GroupItem> groups;	// 금융권 대분류 (그 밖의 필터는 빈 목록)
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class ChipItem {
		private String value;			// 칩 값 (tag 저장값 그대로, 주소에 쓰는 값)
		private String label;			// 화면 글 (저장값과 같음)
		private Integer count;			// 상품 수
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class GroupItem {
		private String value;			// 대분류 이름 (은행권, 비은행권, 정책금융)
		private String label;			// 화면 글 (값과 같음)
		private Integer count;			// 대분류 안 세분류가 하나라도 붙은 상품 수
		private List<String> members;	// 소속 세분류 값 (상품 수 0인 세분류는 뺌)
	}
}
