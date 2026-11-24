package chorong.search.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import chorong.product.entity.LoanProduct;
import chorong.product.entity.TagType;

/*
 * KeywordRule 테스트 (SEARCH-02 단어표): 키워드 14개의 충족 조건, 이유 문구, 기준값(5%, 5,000만원, 60개월) 경계
 */
class KeywordRuleTest {

	private final KeywordRule rule = new KeywordRule();

	private Map<TagType, Set<String>> tags(TagType type, String... values) {
		Map<TagType, Set<String>> tags = new EnumMap<>(TagType.class);
		tags.put(type, Set.of(values));
		return tags;
	}

	@Test
	void 키워드는_정해진_14개다() {
		// Given, When, Then
		assertEquals(14, KeywordRule.KEYWORDS.size());
		assertTrue(rule.isKnown("사회초년생"));
		assertFalse(rule.isKnown("아무거나"));
		assertFalse(rule.isKnown(null));
	}

	@Test
	void 사회초년생은_직장인_또는_청년_학생_대상이면_충족() {
		// Given
		LoanProduct product = mock(LoanProduct.class);

		// When, Then
		assertEquals("청년, 직장인 대상", rule.judge("사회초년생", product, tags(TagType.TARGET, "직장인")));
		assertEquals("청년, 직장인 대상", rule.judge("사회초년생", product, tags(TagType.TARGET, "청년/학생")));
		assertNull(rule.judge("사회초년생", product, tags(TagType.TARGET, "사업자")));
	}

	@Test
	void 대학생_프리랜서_자영업자는_지원_대상_칩으로_판정() {
		// Given
		LoanProduct product = mock(LoanProduct.class);

		// When, Then
		assertEquals("학생도 신청 가능", rule.judge("대학생", product, tags(TagType.TARGET, "청년/학생")));
		assertEquals("직업 제한 없음", rule.judge("프리랜서", product, tags(TagType.TARGET, "제한 없음")));
		assertEquals("사업자 신청 가능", rule.judge("자영업자", product, tags(TagType.TARGET, "사업자")));
		assertNull(rule.judge("대학생", product, tags(TagType.TARGET, "직장인")));
	}

	@Test
	void 신용점수_낮음은_600_이하_또는_신용_무관이면_충족() {
		// Given
		LoanProduct product = mock(LoanProduct.class);

		// When, Then
		assertEquals("신용점수 낮아도 신청 가능", rule.judge("신용점수 낮음", product, tags(TagType.CREDIT, "600 이하")));
		assertEquals("신용점수 낮아도 신청 가능", rule.judge("신용점수 낮음", product, tags(TagType.CREDIT, "신용 무관")));
		assertNull(rule.judge("신용점수 낮음", product, tags(TagType.CREDIT, "801~900")));
	}

	@Test
	void 낮은_금리는_최저_금리_5퍼센트_이하면_충족이고_이유에_최저_금리를_씀() {
		// Given
		LoanProduct low = mock(LoanProduct.class);
		when(low.getRateMin()).thenReturn(new BigDecimal("3.50"));
		LoanProduct edge = mock(LoanProduct.class);
		when(edge.getRateMin()).thenReturn(new BigDecimal("5.00"));
		LoanProduct high = mock(LoanProduct.class);
		when(high.getRateMin()).thenReturn(new BigDecimal("5.01"));

		// When, Then
		assertEquals("최저 3.5%", rule.judge("낮은 금리", low, Map.of()));
		assertEquals("최저 5%", rule.judge("낮은 금리", edge, Map.of()));
		assertNull(rule.judge("낮은 금리", high, Map.of()));
		assertNull(rule.judge("낮은 금리", mock(LoanProduct.class), Map.of()));
	}

	@Test
	void 큰_한도는_5000만원_이상이면_충족이고_이유에_천_단위_쉼표를_씀() {
		// Given
		LoanProduct big = mock(LoanProduct.class);
		when(big.getLimitAmount()).thenReturn(5000L);
		LoanProduct small = mock(LoanProduct.class);
		when(small.getLimitAmount()).thenReturn(4999L);

		// When, Then
		assertEquals("최대 5,000만원", rule.judge("큰 한도", big, Map.of()));
		assertNull(rule.judge("큰 한도", small, Map.of()));
	}

	@Test
	void 큰_한도는_한도_숫자가_없어도_한도_제한_없음_칩이_있으면_충족() {
		// Given
		LoanProduct noNumber = mock(LoanProduct.class);

		// When, Then
		assertEquals("한도 제한 없음", rule.judge("큰 한도", noNumber, tags(TagType.AMOUNT, "한도 제한 없음")));
		assertNull(rule.judge("큰 한도", noNumber, tags(TagType.AMOUNT, "1천만원 이상")));
	}

	@Test
	void 긴_상환기간은_최대_기간_60개월_이상이면_충족() {
		// Given
		LoanProduct long60 = mock(LoanProduct.class);
		when(long60.getTermMax()).thenReturn(60);
		LoanProduct short59 = mock(LoanProduct.class);
		when(short59.getTermMax()).thenReturn(59);

		// When, Then
		assertEquals("최대 60개월", rule.judge("긴 상환기간", long60, Map.of()));
		assertNull(rule.judge("긴 상환기간", short59, Map.of()));
	}

	@Test
	void 수수료_없음과_비대면은_상품_칸_Y로_판정() {
		// Given
		LoanProduct yes = mock(LoanProduct.class);
		when(yes.getNoPrepayFeeYn()).thenReturn("Y");
		when(yes.getOnlineYn()).thenReturn("Y");
		LoanProduct no = mock(LoanProduct.class);
		when(no.getNoPrepayFeeYn()).thenReturn("N");
		when(no.getOnlineYn()).thenReturn("N");

		// When, Then
		assertEquals("중도상환수수료 없음", rule.judge("중도상환수수료 없음", yes, Map.of()));
		assertEquals("비대면 신청", rule.judge("비대면", yes, Map.of()));
		assertNull(rule.judge("중도상환수수료 없음", no, Map.of()));
		assertNull(rule.judge("비대면", no, Map.of()));
	}

	@Test
	void 지금_상황_키워드는_자금_용도_칩으로_판정() {
		// Given
		LoanProduct product = mock(LoanProduct.class);

		// When, Then
		assertEquals("생활비 용도", rule.judge("생활비 급함", product, tags(TagType.PURPOSE, "생활비")));
		assertEquals("대환 가능", rule.judge("갈아타기", product, tags(TagType.PURPOSE, "대환")));
		assertEquals("전월세 용도", rule.judge("전월세", product, tags(TagType.PURPOSE, "전월세")));
		assertEquals("창업 용도", rule.judge("창업 준비", product, tags(TagType.PURPOSE, "창업")));
		assertNull(rule.judge("전월세", product, tags(TagType.PURPOSE, "생활비")));
	}
}
