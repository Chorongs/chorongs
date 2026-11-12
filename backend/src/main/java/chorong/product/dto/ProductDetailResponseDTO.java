package chorong.product.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.product.dto.ProductSummaryDTO.TagItem;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.LoanType;
import chorong.product.entity.ProductRate;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.RateSource;
import chorong.product.entity.Source;
import chorong.product.entity.Tag;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 상품 상세 응답 (PROD-01, 비교용 COM-01 공통)
 * ProductSummaryDTO 칸을 같은 높이로 펼침 (product로 감싸지 않음)
 * 숨김(HIDDEN) 상품은 productId, companyName, productName, productStatus만 채움
 * (나머지 null, tags, features, bandRates는 빈 목록, grouped, reported는 false)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductDetailResponseDTO {

	// ---- ProductSummaryDTO 칸 ----
	private Long productId;
	private String companyName;
	private String productName;
	private List<TagItem> tags;
	private BigDecimal rateMin;
	private BigDecimal rateMax;
	private Long limitAmount;
	private Integer termMax;
	private List<String> features;
	private ProductStatus productStatus;

	// ---- 상세 칸 ----
	private LoanType loanType;
	private Source source;					// KINFA 서민금융진흥원, FSS 금융감독원
	private Boolean grouped;				// 신협 묶음이면 true
	private BigDecimal prepayFeeMax;		// 0 = 없음, 숫자 = 최대 %, null = 정보 없음
	private String incomeNote;				// 소득 조건 원문
	private String extraCond;
	private String targetDetail;
	private Integer ageMin;
	private Integer ageMax;
	private Integer creditMin;
	private Integer creditMax;
	private ApplyInfo applyInfo;
	private List<BandRateItem> bandRates;	// 신용 구간별 금리 (금감원 개인신용, 개인사업자만 5개, 그 밖은 빈 목록)

	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime baseDate;

	private Boolean reported;				// 내가 신고했는지 (1차는 늘 false)

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class ApplyInfo {
		private String applyMethod;			// 신청 방법 (서민만)
		private String contact;				// 연락처 (서민만)
		private String siteUrl;				// 사이트 (서민만)
		private String joinWay;				// 가입 방법 (금감원만)
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class BandRateItem {
		private String creditBand;			// BAND1 ~ BAND5
		private BigDecimal rateMin;
		private BigDecimal rateMax;
		private RateSource rateSource;		// DISCLOSED 공시, ESTIMATED 추정
	}

	// 구간 -> product_rate.rate_key (BAND5는 네 칸의 최저~최고)
	private static final String[] BAND_NAMES = { "BAND1", "BAND2", "BAND3", "BAND4", "BAND5" };
	private static final List<List<String>> BAND_RATE_KEYS = List.of(
			List.of("1"), List.of("4"), List.of("5"), List.of("6"), List.of("10", "11", "12", "13"));

	// 상품 + 태그 목록 + 신용 구간 금리 목록(rate_kind CREDIT) -> 상세 응답
	public static ProductDetailResponseDTO from(LoanProduct product, List<Tag> tags, List<ProductRate> creditRates) {
		ProductSummaryDTO summary = ProductSummaryDTO.from(product, tags);

		ProductDetailResponseDTO dto = new ProductDetailResponseDTO();
		dto.setProductId(summary.getProductId());
		dto.setCompanyName(summary.getCompanyName());
		dto.setProductName(summary.getProductName());
		dto.setTags(summary.getTags());
		dto.setRateMin(summary.getRateMin());
		dto.setRateMax(summary.getRateMax());
		dto.setLimitAmount(summary.getLimitAmount());
		dto.setTermMax(summary.getTermMax());
		dto.setFeatures(summary.getFeatures());
		dto.setProductStatus(summary.getProductStatus());
		dto.setBandRates(new ArrayList<>());
		dto.setGrouped(false);
		dto.setReported(false);

		if (product.getProductStatus() == ProductStatus.HIDDEN) {
			return dto;
		}

		boolean grouped = product.getSourceCode() != null && product.getSourceCode().startsWith("032000");
		dto.setLoanType(product.getLoanType());
		dto.setSource(product.getSource());
		dto.setGrouped(grouped);
		dto.setPrepayFeeMax(product.getPrepayFeeMax());
		dto.setIncomeNote(product.getIncomeNote());
		dto.setExtraCond(product.getExtraCond());
		dto.setTargetDetail(product.getTargetDetail());
		dto.setAgeMin(product.getAgeMin());
		dto.setAgeMax(product.getAgeMax());
		dto.setCreditMin(product.getCreditMin());
		dto.setCreditMax(product.getCreditMax());
		dto.setBaseDate(product.getBaseDate());

		// TODO: raw_json받은 후 추가 진행 / raw_json에서 신청 방법, 연락처, 사이트 (서민) 또는 가입 방법 (금감원)을 골라 담음 (raw_json 키 이름 확인 뒤)
		dto.setApplyInfo(new ApplyInfo());

		boolean bandTarget = product.getSource() == Source.FSS
				&& (product.getLoanType() == LoanType.CREDIT || product.getLoanType() == LoanType.BIZ)
				&& !grouped;
		if (bandTarget) {
			dto.setBandRates(toBandRates(creditRates));
		}
		return dto;
	}

	// BAND1~5 순서로 5개. 행이 없는 구간은 값을 null로 둠, BAND5는 있는 칸만으로 최저~최고, 하나라도 ESTIMATED면 ESTIMATED
	private static List<BandRateItem> toBandRates(List<ProductRate> creditRates) {
		List<BandRateItem> items = new ArrayList<>();
		for (int i = 0; i < BAND_NAMES.length; i++) {
			BigDecimal min = null;
			BigDecimal max = null;
			RateSource source = null;
			for (ProductRate rate : creditRates) {
				if (!BAND_RATE_KEYS.get(i).contains(rate.getRateKey())) {
					continue;
				}
				if (rate.getRateMin() != null && (min == null || rate.getRateMin().compareTo(min) < 0)) {
					min = rate.getRateMin();
				}
				if (rate.getRateMax() != null && (max == null || rate.getRateMax().compareTo(max) > 0)) {
					max = rate.getRateMax();
				}
				if (source != RateSource.ESTIMATED) {
					source = rate.getRateSource();
				}
			}
			items.add(new BandRateItem(BAND_NAMES[i], min, max, source));
		}
		return items;
	}
}
