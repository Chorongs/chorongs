package chorong.common.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * FastAPI POST /products/import 응답 (EXT-05, 상품 정제 결과)
 * FastAPI JSON은 snake_case라 칸마다 @JsonProperty로 맞춤
 * 상품 칸 = loan_product 칸, tags = tag 칸, rates = product_rate 칸
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FastApiCleanResponseDTO {

	@JsonProperty("source_results")
	private List<SourceResultItem> sourceResults;	// 출처별 수집 결과
	private List<ProductItem> products;				// 정제한 상품 (성공한 출처만)

	// 출처별 수집 결과: success false인 출처는 비교에서 뺌 (판매 중단으로 보지 않음, ADMIN-04)
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class SourceResultItem {
		private String source;		// KINFA, FSS
		private Boolean success;	// 수집 성공 여부
		private Integer count;		// 받은 상품 수
		private String error;		// 실패 사유 (성공이면 null)
	}

	// 정제한 상품 1개
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class ProductItem {
		private String source;
		@JsonProperty("source_code")
		private String sourceCode;
		@JsonProperty("loan_type")
		private String loanType;
		@JsonProperty("company_name")
		private String companyName;
		@JsonProperty("product_name")
		private String productName;
		@JsonProperty("rate_min")
		private BigDecimal rateMin;
		@JsonProperty("rate_max")
		private BigDecimal rateMax;
		@JsonProperty("limit_amount")
		private Long limitAmount;			// 만원
		@JsonProperty("term_max")
		private Integer termMax;			// 개월
		@JsonProperty("credit_min")
		private Integer creditMin;
		@JsonProperty("credit_max")
		private Integer creditMax;
		@JsonProperty("age_min")
		private Integer ageMin;
		@JsonProperty("age_max")
		private Integer ageMax;
		@JsonProperty("income_min")
		private Long incomeMin;				// 연 만원
		@JsonProperty("income_max")
		private Long incomeMax;				// 연 만원
		@JsonProperty("income_basis")
		private String incomeBasis;
		@JsonProperty("income_note")
		private String incomeNote;
		@JsonProperty("prepay_fee_max")
		private BigDecimal prepayFeeMax;
		@JsonProperty("no_prepay_fee_yn")
		private String noPrepayFeeYn;
		@JsonProperty("online_yn")
		private String onlineYn;
		@JsonProperty("policy_yn")
		private String policyYn;
		@JsonProperty("rate_type")
		private String rateType;
		@JsonProperty("extra_cond")
		private String extraCond;
		@JsonProperty("target_detail")
		private String targetDetail;
		private String note;
		@JsonProperty("raw_json")
		private String rawJson;
		@JsonProperty("base_date")
		private LocalDate baseDate;
		@JsonProperty("disclose_start")
		private LocalDate discloseStart;
		@JsonProperty("disclose_end")
		private LocalDate discloseEnd;
		private List<TagItem> tags;			// 필터 칩
		private List<RateItem> rates;		// 구간 금리
		@JsonProperty("check_reasons")
		private List<String> checkReasons;	// 확인 필요 사유: NO_NAME, RATE_REVERSED, RATE_OVER_20, NEW_PHRASE
	}

	// 필터 칩 1개 (tag 칸)
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class TagItem {
		@JsonProperty("tag_type")
		private String tagType;
		@JsonProperty("tag_value")
		private String tagValue;
	}

	// 구간 금리 1줄 (product_rate 칸)
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class RateItem {
		@JsonProperty("rate_kind")
		private String rateKind;
		@JsonProperty("rate_key")
		private String rateKey;
		@JsonProperty("rate_min")
		private BigDecimal rateMin;
		@JsonProperty("rate_max")
		private BigDecimal rateMax;
		@JsonProperty("rate_source")
		private String rateSource;
	}
}
