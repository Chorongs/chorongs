package chorong.search.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

import chorong.product.entity.LoanProduct;
import chorong.product.entity.TagType;

/*
 * 간편 검색 키워드 단어표 (SEARCH-02): 키워드 14개 -> 상품이 충족하는지 + 이유 문구
 * 모델이 아니라 고정 규칙. 기준값 (5%, 5,000만원, 60개월)은 아래 상수 (명세서 '설정값')
 *
 * judge(): 충족하면 이유 문구, 아니면 null
 * tags: 상품에 붙은 칩 (태그 종류 -> 칩 값 모음)
 */
@Component
public class KeywordRule {

	public static final BigDecimal LOW_RATE = new BigDecimal("5");	// 낮은 금리: 최저 금리가 이 값(%) 이하
	public static final long BIG_LIMIT = 5000L;						// 큰 한도: 한도가 이 값(만원) 이상
	public static final int LONG_TERM = 60;							// 긴 상환기간: 최대 기간이 이 값(개월) 이상

	/** 정해진 키워드 14개 (그룹 순서: 나는, 원하는 건, 지금 상황) */
	public static final List<String> KEYWORDS = List.of(
			"사회초년생", "대학생", "프리랜서", "자영업자", "신용점수 낮음",
			"낮은 금리", "큰 한도", "긴 상환기간", "중도상환수수료 없음", "비대면",
			"생활비 급함", "갈아타기", "전월세", "창업 준비");

	public boolean isKnown(String keyword) {
		return keyword != null && KEYWORDS.contains(keyword);
	}

	/** 키워드 하나를 상품이 충족하면 이유 문구, 못 맞추면 null */
	public String judge(String keyword, LoanProduct product, Map<TagType, Set<String>> tags) {
		return switch (keyword) {
			case "사회초년생" -> hasAny(tags, TagType.TARGET, "직장인", "청년/학생") ? "청년, 직장인 대상" : null;
			case "대학생" -> hasAny(tags, TagType.TARGET, "청년/학생") ? "학생도 신청 가능" : null;
			case "프리랜서" -> hasAny(tags, TagType.TARGET, "제한 없음") ? "직업 제한 없음" : null;
			case "자영업자" -> hasAny(tags, TagType.TARGET, "사업자") ? "사업자 신청 가능" : null;
			case "신용점수 낮음" -> hasAny(tags, TagType.CREDIT, "600 이하", "신용 무관") ? "신용점수 낮아도 신청 가능" : null;
			case "낮은 금리" -> isLowRate(product) ? "최저 " + product.getRateMin().stripTrailingZeros().toPlainString() + "%" : null;
			case "큰 한도" -> bigLimitReason(product, tags);
			case "긴 상환기간" -> isLongTerm(product) ? "최대 " + product.getTermMax() + "개월" : null;
			case "중도상환수수료 없음" -> "Y".equals(product.getNoPrepayFeeYn()) ? "중도상환수수료 없음" : null;
			case "비대면" -> "Y".equals(product.getOnlineYn()) ? "비대면 신청" : null;
			case "생활비 급함" -> hasAny(tags, TagType.PURPOSE, "생활비") ? "생활비 용도" : null;
			case "갈아타기" -> hasAny(tags, TagType.PURPOSE, "대환") ? "대환 가능" : null;
			case "전월세" -> hasAny(tags, TagType.PURPOSE, "전월세") ? "전월세 용도" : null;
			case "창업 준비" -> hasAny(tags, TagType.PURPOSE, "창업") ? "창업 용도" : null;
			default -> null;
		};
	}

	private boolean isLowRate(LoanProduct product) {
		return product.getRateMin() != null && product.getRateMin().compareTo(LOW_RATE) <= 0;
	}

	private boolean isLongTerm(LoanProduct product) {
		return product.getTermMax() != null && product.getTermMax() >= LONG_TERM;
	}

	// 한도 5,000만원 이상이면 '최대 n만원', 아니면 칩 '한도 제한 없음'이 있을 때 '한도 제한 없음' (숫자가 없어서 따로 정한 문구)
	private String bigLimitReason(LoanProduct product, Map<TagType, Set<String>> tags) {
		if (product.getLimitAmount() != null && product.getLimitAmount() >= BIG_LIMIT) {
			return "최대 " + String.format("%,d", product.getLimitAmount()) + "만원";
		}
		return hasAny(tags, TagType.AMOUNT, "한도 제한 없음") ? "한도 제한 없음" : null;
	}

	private boolean hasAny(Map<TagType, Set<String>> tags, TagType type, String... values) {
		Set<String> own = tags.get(type);
		if (own == null) {
			return false;
		}
		for (String value : values) {
			if (own.contains(value)) {
				return true;
			}
		}
		return false;
	}
}
