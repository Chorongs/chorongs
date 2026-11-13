package chorong.recommend.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 맞춤 추천 응답 (API-06)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecommendResponseDTO {
	private Integer total;					// 30개로 자르기 전 남은 상품 수
	private List<ExcludedItem> excluded;	// 제외 요약 (사유별 개수, 걸러내기 순서)
	private List<String> notes;				// 결과 위 안내 문구
	private String hint;					// 0건일 때 조건 하나를 풀면 가장 많이 늘어나는 조건 문구, 아니면 null
	private List<RecommendItemDTO> items;	// 최대 30개

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class ExcludedItem {
		private String reason;				// 사유 문구 (예: '용도가 다른 상품')
		private Integer count;
	}
}
