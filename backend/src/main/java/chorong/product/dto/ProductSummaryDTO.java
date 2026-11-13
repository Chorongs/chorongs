package chorong.product.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.RateType;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 상품 한 줄 공통 조각 (찜, 기록, 검색, 랭킹, 추천, 상세가 같이 씀)
 * 바꾸는 함수는 이 DTO 안 from() 한 곳 (features 변환 포함)
 * 숨김(HIDDEN) 상품은 productId, companyName, productName, productStatus만 채움 (나머지 null, tags와 features는 빈 목록)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductSummaryDTO {

	private Long productId;
	private String companyName;
	private String productName;
	private List<TagItem> tags;				// 필터 태그 (tagType, tagValue)
	private BigDecimal rateMin;				// 연 %
	private BigDecimal rateMax;				// 연 %
	private Long limitAmount;				// 만원
	private Integer termMax;				// 최대 기간 (개월)
	private List<String> features;			// ONLINE, NO_PREPAY_FEE, POLICY, FIXED, VARIABLE 중 이 순서
	private ProductStatus productStatus;	// ON, CLOSED, HIDDEN

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class TagItem {
		private TagType tagType;
		private String tagValue;
	}

	// 상품 + 태그 목록 -> 한 줄 (다른 기능은 이 함수만 부름)
	public static ProductSummaryDTO from(LoanProduct product, List<Tag> tags) {
		ProductSummaryDTO dto = new ProductSummaryDTO();
		dto.setProductId(product.getProductId());
		dto.setCompanyName(product.getCompanyName());
		dto.setProductName(product.getProductName());
		dto.setProductStatus(product.getProductStatus());

		if (product.getProductStatus() == ProductStatus.HIDDEN) {
			dto.setTags(new ArrayList<>());
			dto.setFeatures(new ArrayList<>());
			return dto;
		}

		List<TagItem> tagItems = new ArrayList<>();
		for (Tag tag : tags) {
			tagItems.add(new TagItem(tag.getTagType(), tag.getTagValue()));
		}
		dto.setTags(tagItems);
		dto.setRateMin(product.getRateMin());
		dto.setRateMax(product.getRateMax());
		dto.setLimitAmount(product.getLimitAmount());
		dto.setTermMax(product.getTermMax());
		dto.setFeatures(toFeatures(product));
		return dto;
	}

	// 특징 칸 -> 특징 코드 (순서: ONLINE, NO_PREPAY_FEE, POLICY, FIXED, VARIABLE)
	private static List<String> toFeatures(LoanProduct product) {
		List<String> features = new ArrayList<>();
		if ("Y".equals(product.getOnlineYn())) {
			features.add("ONLINE");
		}
		if ("Y".equals(product.getNoPrepayFeeYn())) {
			features.add("NO_PREPAY_FEE");
		}
		if ("Y".equals(product.getPolicyYn())) {
			features.add("POLICY");
		}
		RateType rateType = product.getRateType();
		if (rateType == RateType.FIXED || rateType == RateType.BOTH) {
			features.add("FIXED");
		}
		if (rateType == RateType.VARIABLE || rateType == RateType.BOTH) {
			features.add("VARIABLE");
		}
		return features;
	}
}
