package chorong.recommend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

import chorong.product.entity.IncomeBasis;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.LoanType;
import chorong.product.entity.ProductRate;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.RateKind;
import chorong.product.entity.RateSource;
import chorong.product.entity.Source;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import chorong.recommend.dto.RecommendRequestDTO;
import chorong.recommend.service.RecommendRule.Candidate;
import chorong.recommend.service.RecommendRule.Evaluation;
import chorong.recommend.service.RecommendRule.Filter;
import chorong.recommend.service.RecommendRule.Judge;

/*
 * RecommendRule 테스트 (LOAN-01, 02, 05 판정, 예상 금리, 월 상환, 일치도)
 * 기본 상품은 걸러내기, 항목 판정을 모두 통과하게 만들고 테스트마다 한 칸만 바꿈
 * 기획서 7-1 시나리오 2~10, 12 포함
 */
class RecommendRuleTest {

	// 명세서 설정값 그대로
	private final RecommendRule rule = new RecommendRule(0.2, 0.3, 0.1, 0.6, 0.4, 40, 30);

	// 성인(만 35세 이상) 나이 범위
	private static final int ADULT_MIN = 35;
	private static final int ADULT_MAX = 999;

	// ---- 테스트 데이터 ----

	// 기본 상품: 서민, 금리 5~7%, 한도 5,000만원, 최대 60개월, 게시
	private static LoanProduct product() {
		LoanProduct product = BeanUtils.instantiateClass(LoanProduct.class);
		set(product, "productId", 1L);
		set(product, "source", Source.KINFA);
		set(product, "loanType", LoanType.KINFA);
		set(product, "companyName", "테스트기관");
		set(product, "productName", "테스트대출");
		set(product, "rateMin", new BigDecimal("5.00"));
		set(product, "rateMax", new BigDecimal("7.00"));
		set(product, "limitAmount", 5000L);
		set(product, "termMax", 60);
		set(product, "productStatus", ProductStatus.ON);
		return product;
	}

	private static void set(Object target, String field, Object value) {
		ReflectionTestUtils.setField(target, field, value);
	}

	private static Tag tag(long id, TagType type, String value) {
		Tag tag = BeanUtils.instantiateClass(Tag.class);
		set(tag, "tagId", id);
		set(tag, "tagType", type);
		set(tag, "tagValue", value);
		return tag;
	}

	// 기본 태그: 생활비, 제한 없음, 전국, 신용 무관, 원리금균등
	private static List<Tag> passTags() {
		List<Tag> tags = new ArrayList<>();
		tags.add(tag(1, TagType.PURPOSE, "생활비"));
		tags.add(tag(2, TagType.TARGET, "제한 없음"));
		tags.add(tag(3, TagType.REGION, "전국"));
		tags.add(tag(4, TagType.CREDIT, "신용 무관"));
		tags.add(tag(5, TagType.REPAY, "원리금균등"));
		return tags;
	}

	// 기본 태그에서 한 종류만 바꿈
	private static List<Tag> tagsWith(TagType type, String... values) {
		List<Tag> tags = new ArrayList<>(passTags().stream().filter(t -> t.getTagType() != type).toList());
		long id = 10;
		for (String value : values) {
			tags.add(tag(id++, type, value));
		}
		return tags;
	}

	private static ProductRate rate(String key, String min, String max, RateSource source) {
		ProductRate rate = BeanUtils.instantiateClass(ProductRate.class);
		set(rate, "productId", 1L);
		set(rate, "rateKind", RateKind.CREDIT);
		set(rate, "rateKey", key);
		set(rate, "rateMin", new BigDecimal(min));
		set(rate, "rateMax", new BigDecimal(max));
		set(rate, "rateSource", source);
		return rate;
	}

	// 기본 입력: 직장인, 35세 이상, 서울, 연소득 4,000만원, 기존 대출 0, 생활비 1,000만원 36개월, 701~800, 연체 없음, 낮은 금리
	private static RecommendRequestDTO request() {
		return new RecommendRequestDTO("OFFICE", "ADULT", "서울", 4000, 0, false, "생활비", 1000, 36, "BAND3", false,
				List.of("LOW_RATE"));
	}

	private Evaluation evaluate(LoanProduct product, List<Tag> tags, RecommendRequestDTO request) {
		return rule.evaluate(new Candidate(product, tags, List.of()), request, ADULT_MIN, ADULT_MAX);
	}

	private Evaluation evaluate(LoanProduct product, List<Tag> tags) {
		return evaluate(product, tags, request());
	}

	// ---- 월 상환 ----

	@Test
	void 원리금균등_월상환은_1천만원_연6퍼센트_36개월이면_304219원() {
		// Given
		long amount = 10_000_000L;

		// When
		long payment = RecommendRule.monthlyPayment(amount, new BigDecimal("6.00"), 36, false);

		// Then
		assertEquals(304219L, payment);
	}

	@Test
	void 만기일시만_있으면_매달_이자만() {
		// Given
		long amount = 10_000_000L;

		// When
		long payment = RecommendRule.monthlyPayment(amount, new BigDecimal("6.00"), 36, true);

		// Then
		assertEquals(50000L, payment);
	}

	@Test
	void 금리가_0이면_원금을_기간으로_나눔() {
		// Given
		long amount = 3_600_000L;

		// When
		long payment = RecommendRule.monthlyPayment(amount, BigDecimal.ZERO, 36, false);

		// Then
		assertEquals(100000L, payment);
	}

	@Test
	void 계산_기준_한줄은_기간_금리_상환방법() {
		// Given
		LoanProduct product = product();

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertEquals("36개월, 연 6.00%, 원리금균등 기준", e.calcNote);
	}

	@Test
	void 만기일시만_있는_상품은_계산_기준이_매달_이자만() {
		// Given
		List<Tag> tags = tagsWith(TagType.REPAY, "만기일시");

		// When
		Evaluation e = evaluate(product(), tags);

		// Then
		assertEquals("36개월, 연 6.00%, 만기일시(매달 이자만) 기준", e.calcNote);
	}

	@Test
	void 최대_기간이_짧으면_최대_기간으로_계산() {
		// Given
		LoanProduct product = product();
		set(product, "termMax", 24);

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertTrue(e.calcNote.startsWith("24개월"));
	}

	// ---- 예상 금리 ----

	@Test
	void 금감원_개인신용은_고른_구간_금리를_씀() {
		// Given
		LoanProduct product = product();
		set(product, "loanType", LoanType.CREDIT);
		List<ProductRate> rates = List.of(rate("4", "3.00", "4.00", RateSource.DISCLOSED),
				rate("5", "4.10", "5.20", RateSource.DISCLOSED));

		// When
		Evaluation e = rule.evaluate(new Candidate(product, passTags(), rates), request(), ADULT_MIN, ADULT_MAX);

		// Then
		assertEquals("4.10~5.20", e.estRateMin + "~" + e.estRateMax);
	}

	@Test
	void BAND5는_네_칸의_최저_최고() {
		// Given
		LoanProduct product = product();
		set(product, "loanType", LoanType.BIZ);
		List<ProductRate> rates = List.of(rate("10", "8.00", "9.00", RateSource.DISCLOSED),
				rate("13", "12.00", "15.00", RateSource.DISCLOSED));
		RecommendRequestDTO request = request();
		request.setCreditBand("BAND5");

		// When
		Evaluation e = rule.evaluate(new Candidate(product, passTags(), rates), request, ADULT_MIN, ADULT_MAX);

		// Then
		assertEquals("8.00~15.00", e.estRateMin + "~" + e.estRateMax);
	}

	@Test
	void 추정_구간이_섞이면_추정_표시() {
		// Given
		LoanProduct product = product();
		set(product, "loanType", LoanType.BIZ);
		RecommendRequestDTO request = request();
		request.setCreditBand("BAND5");
		List<ProductRate> rates = List.of(rate("10", "8.00", "9.00", RateSource.DISCLOSED),
				rate("11", "9.00", "10.00", RateSource.ESTIMATED));

		// When
		Evaluation e = rule.evaluate(new Candidate(product, passTags(), rates), request, ADULT_MIN, ADULT_MAX);

		// Then
		assertTrue(e.rateEstimated);
	}

	@Test
	void 구간_금리가_없으면_상품_최저_최고() {
		// Given
		LoanProduct product = product();
		set(product, "loanType", LoanType.CREDIT);

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertEquals("5.00~7.00", e.estRateMin + "~" + e.estRateMax);
	}

	@Test
	void 신협_묶음은_계산_기준에_조합마다_다름() {
		// Given
		LoanProduct product = product();
		set(product, "loanType", LoanType.BIZ);
		set(product, "sourceCode", "032000123");

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertTrue(e.calcNote.endsWith("(조합마다 다름)"));
	}

	@Test
	void 시나리오12_금리_없는_상품은_월상환이_없음() {
		// Given
		LoanProduct product = product();
		set(product, "rateMin", null);
		set(product, "rateMax", null);

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertNull(e.monthlyPayment);
	}

	@Test
	void 시나리오12_금리_없는_상품은_금리는_기관_문의() {
		// Given
		LoanProduct product = product();
		set(product, "rateMin", null);
		set(product, "rateMax", null);

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertEquals("금리는 기관 문의", e.calcNote);
	}

	@Test
	void 시나리오12_금리_없는_상품의_낮은_금리_점수는_0점5() {
		// Given
		LoanProduct product = product();
		set(product, "rateMin", null);
		set(product, "rateMax", null);
		Evaluation e = evaluate(product, passTags());

		// When
		double score = rule.priorityScore(e, List.of("LOW_RATE"));

		// Then
		assertEquals(0.5, score, 1e-9);
	}

	// ---- 일치도 ----

	@Test
	void 모두_통과하면_조건_점수_1() {
		// Given
		LoanProduct product = product();

		// When
		double score = rule.conditionScore(evaluate(product, passTags()));

		// Then
		assertEquals(1.0, score, 1e-9);
	}

	@Test
	void 주의_1개면_조건_점수_0점8() {
		// Given
		List<Tag> tags = tagsWith(TagType.REGION);	// 지역 칩 없음 -> 주의

		// When
		double score = rule.conditionScore(evaluate(product(), tags));

		// Then
		assertEquals(0.8, score, 1e-9);
	}

	@Test
	void 부족_1개면_조건_점수_0점7() {
		// Given
		LoanProduct product = product();
		set(product, "termMax", 24);	// 36개월보다 짧음 -> 부족

		// When
		double score = rule.conditionScore(evaluate(product, passTags()));

		// Then
		assertEquals(0.7, score, 1e-9);
	}

	@Test
	void 조건_점수는_0_밑으로_내려가지_않음() {
		// Given: 용도 칩 없음, 지역 칩 없음, 신용 범위 없음, 글 소득 조건, 한도 숫자 없음, 최대 기간 없음, 추가 조건, 연체
		LoanProduct product = product();
		set(product, "incomeBasis", IncomeBasis.OTHER);
		set(product, "limitAmount", null);
		set(product, "termMax", null);
		set(product, "extraCond", "무주택");
		List<Tag> tags = List.of(tag(2, TagType.TARGET, "제한 없음"));
		RecommendRequestDTO request = request();
		request.setOverdue(true);

		// When
		double score = rule.conditionScore(evaluate(product, tags, request));

		// Then
		assertEquals(0.0, score, 1e-9);
	}

	@Test
	void 시나리오3_금감원_개인신용은_한도와_기간_칸없음으로_0점1씩만_뺌() {
		// Given
		LoanProduct product = product();
		set(product, "source", Source.FSS);
		set(product, "loanType", LoanType.CREDIT);
		set(product, "limitAmount", null);
		set(product, "termMax", null);

		// When
		double score = rule.conditionScore(evaluate(product, passTags()));

		// Then
		assertEquals(0.8, score, 1e-9);
	}

	@Test
	void 시나리오3_금감원_개인신용은_한도_확인_필요_태그() {
		// Given
		LoanProduct product = product();
		set(product, "source", Source.FSS);
		set(product, "loanType", LoanType.CREDIT);
		set(product, "limitAmount", null);

		// When
		List<String> tags = rule.judgeTags(evaluate(product, passTags()));

		// Then
		assertTrue(tags.contains("한도 확인 필요"));
	}

	@Test
	void 시나리오3_금감원_개인신용은_제외되지_않음() {
		// Given
		LoanProduct product = product();
		set(product, "loanType", LoanType.CREDIT);
		set(product, "limitAmount", null);

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertNull(e.failed);
	}

	@Test
	void 일치도는_조건_60_고른_기준_40() {
		// Given
		double conditionScore = 1.0;

		// When
		double matchRate = rule.matchRate(conditionScore, 0.5);

		// Then
		assertEquals(80.0, matchRate, 1e-9);
	}

	@Test
	void 순위_점수는_1등이_1() {
		// Given
		int count = 5;

		// When
		double score = RecommendRule.rankScore(1, count);

		// Then
		assertEquals(1.0, score, 1e-9);
	}

	@Test
	void 순위_점수는_꼴등이_0() {
		// Given
		int count = 5;

		// When
		double score = RecommendRule.rankScore(5, count);

		// Then
		assertEquals(0.0, score, 1e-9);
	}

	@Test
	void 같은_값은_같은_순위() {
		// Given
		List<BigDecimal> rates = List.of(new BigDecimal("5.00"), new BigDecimal("5.00"), new BigDecimal("6.00"));

		// When
		int rank = RecommendRule.rankOf(new BigDecimal("6.00"), rates);

		// Then
		assertEquals(3, rank);
	}

	@Test
	void 비대면_모름이면_고른_기준_점수_0점5() {
		// Given
		Evaluation e = evaluate(product(), passTags());	// online_yn null

		// When
		double score = rule.priorityScore(e, List.of("ONLINE"));

		// Then
		assertEquals(0.5, score, 1e-9);
	}

	// ---- 걸러내기 ----

	@Test
	void 시나리오2_한도가_필요_금액보다_작으면_제외() {
		// Given
		LoanProduct product = product();
		set(product, "limitAmount", 500L);

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertEquals(Filter.LIMIT, e.failed);
	}

	@Test
	void 시나리오4_749점_기준_서민_상품에_701_800은_제외되지_않음() {
		// Given
		LoanProduct product = product();
		set(product, "creditMin", 0);
		set(product, "creditMax", 749);
		List<Tag> tags = tagsWith(TagType.CREDIT, "600 이하", "601~700", "701~800");

		// When
		Evaluation e = evaluate(product, tags);

		// Then
		assertNull(e.failed);
	}

	@Test
	void 시나리오4_749점_기준_서민_상품에_701_800은_신용_구간_주의() {
		// Given
		LoanProduct product = product();
		set(product, "creditMin", 0);
		set(product, "creditMax", 749);
		List<Tag> tags = tagsWith(TagType.CREDIT, "600 이하", "601~700", "701~800");

		// When
		List<String> judgeTags = rule.judgeTags(evaluate(product, tags));

		// Then
		assertEquals("신용 구간 주의", judgeTags.get(0));
	}

	@Test
	void 신용점수_범위_밖이면_제외() {
		// Given
		LoanProduct product = product();
		set(product, "creditMin", 0);
		set(product, "creditMax", 600);
		List<Tag> tags = tagsWith(TagType.CREDIT, "600 이하");

		// When
		Evaluation e = evaluate(product, tags);

		// Then
		assertEquals(Filter.CREDIT, e.failed);
	}

	@Test
	void 전세_상품의_신용은_칸없음() {
		// Given
		LoanProduct product = product();
		set(product, "loanType", LoanType.RENT);
		List<Tag> tags = tagsWith(TagType.CREDIT, "심사 후 결정");

		// When
		Evaluation e = evaluate(product, tags);

		// Then
		assertEquals(Judge.MISSING, e.credit);
	}

	@Test
	void 시나리오7_부부합산_상품에_본인_소득이_상한을_넘으면_제외() {
		// Given
		LoanProduct product = product();
		set(product, "incomeBasis", IncomeBasis.COUPLE);
		set(product, "incomeMax", 3000);

		// When
		Evaluation e = evaluate(product, passTags());	// 연소득 4,000만원

		// Then
		assertEquals(Filter.INCOME, e.failed);
	}

	@Test
	void 부부합산_상품에_본인_소득이_상한_이하면_주의() {
		// Given
		LoanProduct product = product();
		set(product, "incomeBasis", IncomeBasis.COUPLE);
		set(product, "incomeMax", 6000);

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertEquals(Judge.WARN, e.income);
	}

	@Test
	void 시나리오6_용도_기타면_생활비_상품은_용도_확인_필요() {
		// Given
		RecommendRequestDTO request = request();
		request.setPurpose("기타");

		// When
		List<String> judgeTags = rule.judgeTags(evaluate(product(), passTags(), request));

		// Then
		assertEquals("용도 확인 필요", judgeTags.get(0));
	}

	@Test
	void 시나리오6_용도_기타면_다른_용도_상품은_제외() {
		// Given
		RecommendRequestDTO request = request();
		request.setPurpose("기타");
		List<Tag> tags = tagsWith(TagType.PURPOSE, "사업 운영");

		// When
		Evaluation e = evaluate(product(), tags, request);

		// Then
		assertEquals(Filter.PURPOSE, e.failed);
	}

	@Test
	void 용도_기타면_용도_칩_없는_상품은_주의로_통과() {
		// Given
		RecommendRequestDTO request = request();
		request.setPurpose("기타");
		List<Tag> tags = tagsWith(TagType.PURPOSE);

		// When
		Evaluation e = evaluate(product(), tags, request);

		// Then
		assertEquals(Judge.WARN, e.purpose);
	}

	@Test
	void 고른_용도가_상품_칩에_없으면_제외() {
		// Given
		List<Tag> tags = tagsWith(TagType.PURPOSE, "전월세");

		// When
		Evaluation e = evaluate(product(), tags);

		// Then
		assertEquals(Filter.PURPOSE, e.failed);
	}

	@Test
	void 농어업인은_농어업_특별_지원_대상_통과() {
		// Given
		LoanProduct product = product();
		set(product, "targetDetail", "농어업");
		List<Tag> tags = tagsWith(TagType.TARGET, "특별 지원 대상");
		RecommendRequestDTO request = request();
		request.setJob("FARM");

		// When
		Evaluation e = evaluate(product, tags, request);

		// Then
		assertEquals(Judge.PASS, e.target);
	}

	@Test
	void 농어업이_아닌_특별_지원_대상은_제외() {
		// Given
		LoanProduct product = product();
		set(product, "targetDetail", "채무조정");
		List<Tag> tags = tagsWith(TagType.TARGET, "특별 지원 대상");
		RecommendRequestDTO request = request();
		request.setJob("FARM");

		// When
		Evaluation e = evaluate(product, tags, request);

		// Then
		assertEquals(Filter.TARGET, e.failed);
	}

	@Test
	void 청년은_직업과_상관없이_청년_학생_대상_통과() {
		// Given
		List<Tag> tags = tagsWith(TagType.TARGET, "청년/학생");
		RecommendRequestDTO request = request();
		request.setJob("HOMEMAKER");

		// When
		Evaluation e = rule.evaluate(new Candidate(product(), tags, List.of()), request, 19, 34);

		// Then
		assertEquals(Judge.PASS, e.target);
	}

	@Test
	void 사는_지역이_다르면_제외() {
		// Given
		List<Tag> tags = tagsWith(TagType.REGION, "부산");

		// When
		Evaluation e = evaluate(product(), tags);	// 서울

		// Then
		assertEquals(Filter.REGION, e.failed);
	}

	@Test
	void 지역을_안_고르면_주의() {
		// Given
		List<Tag> tags = tagsWith(TagType.REGION, "부산");
		RecommendRequestDTO request = request();
		request.setRegion(null);

		// When
		Evaluation e = evaluate(product(), tags, request);

		// Then
		assertEquals(Judge.WARN, e.region);
	}

	@Test
	void 나이_범위가_걸치면_주의() {
		// Given
		LoanProduct product = product();
		set(product, "ageMax", 39);		// 39세 이하 상품에 35세 이상

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertEquals(Judge.WARN, e.age);
	}

	@Test
	void 나이_범위가_안_겹치면_제외() {
		// Given
		LoanProduct product = product();
		set(product, "ageMax", 34);

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertEquals(Filter.AGE, e.failed);
	}

	// ---- 항목 판정 ----

	@Test
	void 시나리오5_연체면_연체_주의_태그() {
		// Given
		RecommendRequestDTO request = request();
		request.setOverdue(true);

		// When
		List<String> judgeTags = rule.judgeTags(evaluate(product(), passTags(), request));

		// Then
		assertEquals("연체 주의", judgeTags.get(0));
	}

	@Test
	void 시나리오5_연체여도_제외하지_않음() {
		// Given
		RecommendRequestDTO request = request();
		request.setOverdue(true);

		// When
		Evaluation e = evaluate(product(), passTags(), request);

		// Then
		assertNull(e.failed);
	}

	@Test
	void 시나리오8_기존_대출_모름이면_기존_대출을_빼고_월부담_계산() {
		// Given
		RecommendRequestDTO unknown = request();
		unknown.setDebtMonthly(100);
		unknown.setDebtUnknown(true);
		Double withoutDebt = evaluate(product(), passTags()).burdenRatio;	// 기존 대출 0

		// When
		Double ratio = evaluate(product(), passTags(), unknown).burdenRatio;

		// Then
		assertEquals(withoutDebt, ratio);
	}

	@Test
	void 월부담이_40퍼센트를_넘으면_월_부담_큼() {
		// Given
		RecommendRequestDTO request = request();
		request.setIncome(500);		// 월 30만원 x 12 / 500만원 = 약 73%

		// When
		List<String> judgeTags = rule.judgeTags(evaluate(product(), passTags(), request));

		// Then
		assertEquals("월 부담 큼", judgeTags.get(0));
	}

	@Test
	void 최대_기간이_갚을_기간보다_짧으면_부족() {
		// Given
		LoanProduct product = product();
		set(product, "termMax", 24);

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertEquals(Judge.SHORT, e.term);
	}

	@Test
	void 추가_조건이_있으면_주의() {
		// Given
		LoanProduct product = product();
		set(product, "extraCond", "무주택 세대주");

		// When
		Evaluation e = evaluate(product, passTags());

		// Then
		assertEquals(Judge.WARN, e.extra);
	}

	// ---- 판정 결과, 문장, 태그 ----

	@Test
	void 상품1개_판정_제외면_FAIL() {
		// Given
		LoanProduct product = product();
		set(product, "limitAmount", 500L);

		// When
		String result = rule.eligibilityResult(evaluate(product, passTags()));

		// Then
		assertEquals("FAIL", result);
	}

	@Test
	void 상품1개_판정_기간_부족은_WARN() {
		// Given
		LoanProduct product = product();
		set(product, "termMax", 24);

		// When
		String result = rule.eligibilityResult(evaluate(product, passTags()));

		// Then
		assertEquals("WARN", result);
	}

	@Test
	void 상품1개_판정_모두_충족이면_PASS() {
		// Given
		LoanProduct product = product();

		// When
		String result = rule.eligibilityResult(evaluate(product, passTags()));

		// Then
		assertEquals("PASS", result);
	}

	@Test
	void 판단_태그는_최대_3개() {
		// Given: 주의 4개 (용도 확인, 연령, 소득, 연체)
		LoanProduct product = product();
		set(product, "ageMax", 39);
		set(product, "incomeBasis", IncomeBasis.OTHER);
		RecommendRequestDTO request = request();
		request.setPurpose("기타");
		request.setOverdue(true);

		// When
		List<String> judgeTags = rule.judgeTags(evaluate(product, passTags(), request));

		// Then
		assertEquals(List.of("용도 확인 필요", "연령 조건 있음", "소득 조건 있음"), judgeTags);
	}

	@Test
	void 이유_문장은_최대_5개() {
		// Given: 나이, 소득 조건 + 비대면, 정책, 수수료 없음 + 금리, 한도, 월 부담
		LoanProduct product = product();
		set(product, "ageMin", 19);
		set(product, "incomeMax", 9000);
		set(product, "onlineYn", "Y");
		set(product, "policyYn", "Y");
		set(product, "noPrepayFeeYn", "Y");
		RecommendRequestDTO request = request();
		request.setPriorities(List.of("ONLINE", "POLICY"));

		// When
		List<String> reasons = rule.reasons(evaluate(product, passTags(), request), request.getPriorities(), true);

		// Then
		assertEquals(5, reasons.size());
	}

	@Test
	void 고른_기준_문장은_고른_기준_자리로_당겨옴() {
		// Given
		LoanProduct product = product();
		set(product, "noPrepayFeeYn", "Y");
		RecommendRequestDTO request = request();
		request.setPriorities(List.of("NO_PREPAY_FEE"));

		// When
		List<String> reasons = rule.reasons(evaluate(product, passTags(), request), request.getPriorities(), true);

		// Then: 신용 문장 다음 (나이, 소득 조건 없음)
		assertEquals("중도상환수수료가 없어요", reasons.get(1));
	}

	@Test
	void 기간_부족이면_최대_N개월_문장() {
		// Given
		LoanProduct product = product();
		set(product, "termMax", 24);

		// When
		List<String> reasons = rule.reasons(evaluate(product, passTags()), List.of("ONLINE"), false);

		// Then
		assertTrue(reasons.contains("최대 24개월까지만 빌릴 수 있어요"));
	}

	@Test
	void 상품1개_판정은_금리_순위_문장을_넣지_않음() {
		// Given
		Evaluation e = evaluate(product(), passTags());
		e.rateRank = 1;

		// When
		List<String> reasons = rule.reasons(e, List.of("LOW_RATE"), false);

		// Then
		assertFalse(reasons.stream().anyMatch(r -> r.startsWith("예상 금리가 후보 중")));
	}

	// ---- 입력 도우미 ----

	@Test
	void 시나리오9_전월세_기간_모름은_120개월로_계산() {
		// Given
		String purpose = "전월세";

		// When
		int months = RecommendRule.termOf(purpose, 0);

		// Then
		assertEquals(120, months);
	}

	@Test
	void 시나리오10_생활비에_180개월은_허용하지_않음() {
		// Given
		String purpose = "생활비";

		// When
		boolean valid = RecommendRule.isValidMonths(purpose, 180);

		// Then
		assertFalse(valid);
	}

	@Test
	void 생일_전이면_만나이가_한살_적음() {
		// Given
		LocalDate today = LocalDate.of(2026, 3, 1);

		// When
		int age = RecommendRule.ageOf("1990", "05-10", today);

		// Then
		assertEquals(35, age);
	}

	@Test
	void 한_칸_높은_신용_구간() {
		// Given
		String band = "BAND3";

		// When
		String higher = RecommendRule.higherBand(band);

		// Then
		assertEquals("BAND2", higher);
	}

	@Test
	void BAND1보다_높은_구간은_없음() {
		// Given
		String band = "BAND1";

		// When
		String higher = RecommendRule.higherBand(band);

		// Then
		assertNull(higher);
	}

	@Test
	void 금액_글은_1억_넘으면_억으로_묶음() {
		// Given
		long amount = 15000;

		// When
		String text = RecommendRule.formatMoney(amount);

		// Then
		assertEquals("1억 5,000만원", text);
	}

	@Test
	void 금액_글은_1억이면_1억원() {
		// Given
		long amount = 10000;

		// When
		String text = RecommendRule.formatMoney(amount);

		// Then
		assertEquals("1억원", text);
	}
}
