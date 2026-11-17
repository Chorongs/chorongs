package chorong.recommend.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.product.dto.ProductSummaryDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 저장한 추천 목록 (API-38 GET, LOAN-04)
 * 상품은 지금 정보 (productStatus로 판매 종료, 숨김 표시) / 일치도, 예상 금리, 월 상환은 저장하지 않아 없음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SavedRecommendResponseDTO {
	private List<SaveItem> saves;			// 최신 저장 먼저

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class SaveItem {
		private Long saveId;
		private String conditionLabel;		// 예: '생활비 1,000만원 / 3년 / 직장인'
		@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
		private LocalDateTime createdAt;
		private List<ProductItem> products;	// 순위순
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class ProductItem {
		private Integer rankNo;
		private ProductSummaryDTO product;
	}
}
