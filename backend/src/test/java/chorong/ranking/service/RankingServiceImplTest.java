package chorong.ranking.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.ranking.dto.RankingRequestDTO;
import chorong.ranking.dto.RankingResponseDTO;

/*
 * RankingServiceImpl.getRanking 테스트 (RANK-01, 02 대출 랭킹)
 * 기대값 출처: be_ranking.md RANK-01, 02 / be_common.md B1, B2, B10 (랭킹 최대 30, 캐시)
 *   - metric rate, limit, term, views / dir asc, desc 외에는 400 (B1), cat 모르는 값 400 (B2)
 *   - 게시(ON) 상품만, 금리, 한도, 기간 값이 없는 상품은 asc, desc 모두 맨 뒤, 같으면 조회수 → 이름, 상위 30개
 *   - cat은 SECTOR 태그 값으로 거름 (대분류를 고르면 그 세분류 전체: 은행권, 비은행권, 정책금융은 서버 상수)
 *   - 결과는 MemoryCache.RANKING에 (cat, metric, dir) 조합으로 저장
 * 명세서에 없는 선택 (사용자 결정, PR 본문에 적을 것):
 *   - metric=rate는 rateMin 기준 / 같을 때 조회수는 높은 순, 이름은 가나다순 / total은 돌려준 개수
 *   - baseDate는 ON 상품 중 가장 최근 baseDate (없으면 null) / metric, dir이 null이어도 400
 * 명세서와 다른 곳: cat에 세분류(저축은행 등)를 주면 명세서는 허용(API-04)이지만 이 구현은 400
 *   → 명세서 수정 제안 전달 대기 중이라 지금 구현 기준으로 확인함
 * DB 대신 Mockito 가짜 Repository를 쓰고, MemoryCache는 진짜를 씀
 */
class RankingServiceImplTest {

	private LoanProductRepository loanProductRepository;
	private TagRepository tagRepository;
	private ProductTagRepository productTagRepository;
	private MemoryCache memoryCache;
	private RankingServiceImpl rankingService;

	@BeforeEach
	void setUp() {
		loanProductRepository = mock(LoanProductRepository.class);
		tagRepository = mock(TagRepository.class);
		productTagRepository = mock(ProductTagRepository.class);
		memoryCache = new MemoryCache();
		rankingService = new RankingServiceImpl(loanProductRepository, tagRepository, productTagRepository, memoryCache);
	}

	// ---------- 테스트 데이터 ----------

	private static LoanProduct product(long id, String name, BigDecimal rateMin, Long limitAmount, Integer termMax,
			Long viewCount, LocalDateTime baseDate) {
		LoanProduct product = BeanUtils.instantiateClass(LoanProduct.class);
		ReflectionTestUtils.setField(product, "productId", id);
		ReflectionTestUtils.setField(product, "companyName", "기관" + id);
		ReflectionTestUtils.setField(product, "productName", name);
		ReflectionTestUtils.setField(product, "productStatus", ProductStatus.ON);
		ReflectionTestUtils.setField(product, "rateMin", rateMin);
		ReflectionTestUtils.setField(product, "limitAmount", limitAmount);
		ReflectionTestUtils.setField(product, "termMax", termMax);
		ReflectionTestUtils.setField(product, "viewCount", viewCount);
		ReflectionTestUtils.setField(product, "baseDate", baseDate);
		return product;
	}

	private static LoanProduct product(long id, String name, BigDecimal rateMin, Long limitAmount, Integer termMax,
			Long viewCount) {
		return product(id, name, rateMin, limitAmount, termMax, viewCount, LocalDateTime.of(2026, 11, 1, 0, 0));
	}

	private static LoanProduct rateProduct(long id, String rateMin) {
		return product(id, "상품" + id, rateMin == null ? null : new BigDecimal(rateMin), 1000L, 12, 0L);
	}

	private static Tag tag(long tagId, String tagValue) {
		Tag tag = BeanUtils.instantiateClass(Tag.class);
		ReflectionTestUtils.setField(tag, "tagId", tagId);
		ReflectionTestUtils.setField(tag, "tagType", TagType.SECTOR);
		ReflectionTestUtils.setField(tag, "tagValue", tagValue);
		return tag;
	}

	private static ProductTag productTag(long tagId, long productId) {
		ProductTag productTag = BeanUtils.instantiateClass(ProductTag.class);
		ReflectionTestUtils.setField(productTag, "tagId", tagId);
		ReflectionTestUtils.setField(productTag, "productId", productId);
		return productTag;
	}

	private static RankingRequestDTO request(String cat, String metric, String dir) {
		RankingRequestDTO request = new RankingRequestDTO();
		request.setCat(cat);
		request.setMetric(metric);
		request.setDir(dir);
		return request;
	}

	private void givenOnProducts(LoanProduct... products) {
		when(loanProductRepository.findByProductStatus(ProductStatus.ON)).thenReturn(List.of(products));
	}

	private static List<Long> idsOf(RankingResponseDTO response) {
		return response.getItems().stream().map(item -> item.getProduct().getProductId()).toList();
	}

	private static BusinessException invalid(Runnable call) {
		return assertThrows(BusinessException.class, call::run);
	}

	// ---------- 값 확인 (B1, B2) ----------

	@ParameterizedTest
	@ValueSource(strings = { "rate", "limit", "term", "views" })
	void 정해진_metric_네_가지는_통과한다(String metric) {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, metric, "asc"));

		// Then
		assertEquals(1, response.getItems().size());
	}

	@ParameterizedTest
	@ValueSource(strings = { "asc", "desc" })
	void 정해진_dir_두_가지는_통과한다(String dir) {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", dir));

		// Then
		assertEquals(1, response.getItems().size());
	}

	@Test
	void 모르는_metric이면_400이다() {
		// Given, When
		BusinessException e = invalid(() -> rankingService.getRanking(request(null, "abc", "asc")));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 모르는_dir이면_400이다() {
		// Given, When
		BusinessException e = invalid(() -> rankingService.getRanking(request(null, "rate", "up")));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 대문자_metric은_400이다() {
		// Given, When
		BusinessException e = invalid(() -> rankingService.getRanking(request(null, "RATE", "asc")));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 대문자_dir은_400이다() {
		// Given, When
		BusinessException e = invalid(() -> rankingService.getRanking(request(null, "rate", "ASC")));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void SQL을_섞은_metric은_400이다() {
		// Given, When
		BusinessException e = invalid(
				() -> rankingService.getRanking(request(null, "rate; drop table loan_product", "asc")));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void metric이_없으면_400이다() {
		// Given, When
		BusinessException e = invalid(() -> rankingService.getRanking(request(null, null, "asc")));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void dir이_없으면_400이다() {
		// Given, When
		BusinessException e = invalid(() -> rankingService.getRanking(request(null, "rate", null)));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 모르는_cat이면_400이다() {
		// Given, When
		BusinessException e = invalid(() -> rankingService.getRanking(request("없는금융권", "rate", "asc")));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 세분류_cat은_400이다() {
		// Given (명세서 API-04는 세분류도 허용, 이 구현은 대분류 3개만 허용)

		// When
		BusinessException e = invalid(() -> rankingService.getRanking(request("저축은행", "rate", "asc")));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 값이_틀리면_DB를_읽지_않는다() {
		// Given, When
		invalid(() -> rankingService.getRanking(request("은행권", "abc", "asc")));

		// Then
		verifyNoInteractions(loanProductRepository, tagRepository, productTagRepository);
	}

	@Test
	void 모르는_cat이면_DB를_읽지_않는다() {
		// Given, When
		invalid(() -> rankingService.getRanking(request("없는금융권", "rate", "asc")));

		// Then
		verifyNoInteractions(loanProductRepository, tagRepository, productTagRepository);
	}

	// ---------- 게시(ON) 상품만 ----------

	@Test
	void 게시_ON_상품만_조회한다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		verify(loanProductRepository).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void 판매_종료_숨김_상품을_따로_조회하지_않는다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		verify(loanProductRepository, never()).findByProductStatus(ProductStatus.CLOSED);
		verify(loanProductRepository, never()).findByProductStatus(ProductStatus.HIDDEN);
	}

	// ---------- 기준 정렬 ----------

	@Test
	void 금리순_오름차순은_낮은_금리부터이다() {
		// Given
		givenOnProducts(rateProduct(1, "5.0"), rateProduct(2, "3.0"), rateProduct(3, "4.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(List.of(2L, 3L, 1L), idsOf(response));
	}

	@Test
	void 금리순_내림차순은_높은_금리부터이다() {
		// Given
		givenOnProducts(rateProduct(1, "5.0"), rateProduct(2, "3.0"), rateProduct(3, "4.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "desc"));

		// Then
		assertEquals(List.of(1L, 3L, 2L), idsOf(response));
	}

	@Test
	void 금리가_없는_상품은_오름차순에서_맨_뒤이다() {
		// Given
		givenOnProducts(rateProduct(1, null), rateProduct(2, "3.0"), rateProduct(3, "4.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(List.of(2L, 3L, 1L), idsOf(response));
	}

	@Test
	void 금리가_없는_상품은_내림차순에서도_맨_뒤이다() {
		// Given
		givenOnProducts(rateProduct(1, null), rateProduct(2, "3.0"), rateProduct(3, "4.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "desc"));

		// Then
		assertEquals(List.of(3L, 2L, 1L), idsOf(response));
	}

	@Test
	void 한도순_내림차순은_큰_한도부터이다() {
		// Given
		givenOnProducts(product(1, "가", null, 1000L, 12, 0L), product(2, "나", null, 5000L, 12, 0L),
				product(3, "다", null, 3000L, 12, 0L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "limit", "desc"));

		// Then
		assertEquals(List.of(2L, 3L, 1L), idsOf(response));
	}

	@Test
	void 한도가_없는_상품은_내림차순에서도_맨_뒤이다() {
		// Given
		givenOnProducts(product(1, "가", null, null, 12, 0L), product(2, "나", null, 5000L, 12, 0L),
				product(3, "다", null, 3000L, 12, 0L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "limit", "desc"));

		// Then
		assertEquals(List.of(2L, 3L, 1L), idsOf(response));
	}

	@Test
	void 한도가_없는_상품은_오름차순에서도_맨_뒤이다() {
		// Given
		givenOnProducts(product(1, "가", null, null, 12, 0L), product(2, "나", null, 5000L, 12, 0L),
				product(3, "다", null, 3000L, 12, 0L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "limit", "asc"));

		// Then
		assertEquals(List.of(3L, 2L, 1L), idsOf(response));
	}

	@Test
	void 기간순_오름차순은_짧은_기간부터이다() {
		// Given
		givenOnProducts(product(1, "가", null, 1000L, 36, 0L), product(2, "나", null, 1000L, 12, 0L),
				product(3, "다", null, 1000L, 24, 0L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "term", "asc"));

		// Then
		assertEquals(List.of(2L, 3L, 1L), idsOf(response));
	}

	@Test
	void 기간이_없는_상품은_내림차순에서도_맨_뒤이다() {
		// Given
		givenOnProducts(product(1, "가", null, 1000L, null, 0L), product(2, "나", null, 1000L, 12, 0L),
				product(3, "다", null, 1000L, 24, 0L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "term", "desc"));

		// Then
		assertEquals(List.of(3L, 2L, 1L), idsOf(response));
	}

	@Test
	void 인기순_내림차순은_조회수_많은_순이다() {
		// Given
		givenOnProducts(product(1, "가", null, 1000L, 12, 10L), product(2, "나", null, 1000L, 12, 300L),
				product(3, "다", null, 1000L, 12, 50L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "views", "desc"));

		// Then
		assertEquals(List.of(2L, 3L, 1L), idsOf(response));
	}

	@Test
	void 기준값이_같으면_조회수_높은_순이다() {
		// Given
		givenOnProducts(product(1, "가", new BigDecimal("3.0"), 1000L, 12, 10L),
				product(2, "나", new BigDecimal("3.0"), 1000L, 12, 90L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(List.of(2L, 1L), idsOf(response));
	}

	@Test
	void 기준값과_조회수가_같으면_이름_가나다순이다() {
		// Given
		givenOnProducts(product(1, "나상품", new BigDecimal("3.0"), 1000L, 12, 10L),
				product(2, "가상품", new BigDecimal("3.0"), 1000L, 12, 10L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(List.of(2L, 1L), idsOf(response));
	}

	@Test
	void 값이_없는_상품끼리도_조회수_높은_순이다() {
		// Given
		givenOnProducts(product(1, "가", null, 1000L, 12, 10L), product(2, "나", null, 1000L, 12, 90L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(List.of(2L, 1L), idsOf(response));
	}

	@Test
	void 인기순에서_조회수가_같으면_이름_가나다순이다() {
		// Given
		givenOnProducts(product(1, "나상품", null, 1000L, 12, 10L), product(2, "가상품", null, 1000L, 12, 10L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "views", "desc"));

		// Then
		assertEquals(List.of(2L, 1L), idsOf(response));
	}

	// ---------- 상위 30개, 순위 번호, 응답 값 ----------

	private void givenManyProducts(int count) {
		List<LoanProduct> products = new ArrayList<>();
		for (int i = 1; i <= count; i++) {
			products.add(rateProduct(i, i + ".0"));
		}
		when(loanProductRepository.findByProductStatus(ProductStatus.ON)).thenReturn(products);
	}

	@Test
	void 상품이_35개여도_30개만_돌려준다() {
		// Given
		givenManyProducts(35);

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(30, response.getItems().size());
	}

	@Test
	void 상위_30개는_정렬_기준_앞쪽_30개이다() {
		// Given
		givenManyProducts(35);

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(1L, response.getItems().get(0).getProduct().getProductId());
		assertEquals(30L, response.getItems().get(29).getProduct().getProductId());
	}

	@Test
	void 순위_번호는_1부터_차례로_붙는다() {
		// Given
		givenManyProducts(35);

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		List<Integer> rankNos = response.getItems().stream().map(RankingResponseDTO.RankingItem::getRankNo).toList();
		assertEquals(java.util.stream.IntStream.rangeClosed(1, 30).boxed().toList(), rankNos);
	}

	@Test
	void 상품이_30개_미만이면_있는_만큼만_돌려준다() {
		// Given
		givenManyProducts(3);

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(3, response.getItems().size());
	}

	@Test
	void total은_돌려준_개수이다() {
		// Given
		givenManyProducts(35);

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(30, response.getTotal());
	}

	@Test
	void 상품이_없으면_빈_목록_total_0_baseDate_null이다() {
		// Given
		when(loanProductRepository.findByProductStatus(ProductStatus.ON)).thenReturn(List.of());

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(0, response.getItems().size());
		assertEquals(0, response.getTotal());
		assertNull(response.getBaseDate());
	}

	@Test
	void 상품이_없으면_상품_태그를_조회하지_않는다() {
		// Given
		when(loanProductRepository.findByProductStatus(ProductStatus.ON)).thenReturn(List.of());

		// When
		rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		verify(productTagRepository, never()).findByProductIdIn(anyCollection());
	}

	@Test
	void rate의_기준값은_rateMin이다() {
		// Given
		LoanProduct p = product(1, "가", new BigDecimal("3.5"), 1000L, 12, 7L);
		ReflectionTestUtils.setField(p, "rateMax", new BigDecimal("9.9"));
		givenOnProducts(p);

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(new BigDecimal("3.5"), response.getItems().get(0).getMetricValue());
	}

	@Test
	void limit의_기준값은_한도_만원이다() {
		// Given
		givenOnProducts(product(1, "가", new BigDecimal("3.5"), 5000L, 12, 7L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "limit", "desc"));

		// Then
		assertEquals(BigDecimal.valueOf(5000L), response.getItems().get(0).getMetricValue());
	}

	@Test
	void term의_기준값은_최대_기간_개월이다() {
		// Given
		givenOnProducts(product(1, "가", new BigDecimal("3.5"), 5000L, 36, 7L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "term", "asc"));

		// Then
		assertEquals(BigDecimal.valueOf(36), response.getItems().get(0).getMetricValue());
	}

	@Test
	void views의_기준값은_조회수이다() {
		// Given
		givenOnProducts(product(1, "가", new BigDecimal("3.5"), 5000L, 36, 77L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "views", "desc"));

		// Then
		assertEquals(BigDecimal.valueOf(77L), response.getItems().get(0).getMetricValue());
	}

	@Test
	void 기준값이_없는_상품의_metricValue는_null이다() {
		// Given
		givenOnProducts(rateProduct(1, null));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertNull(response.getItems().get(0).getMetricValue());
	}

	@Test
	void 중도상환수수료_최대는_상품_값_그대로이다() {
		// Given
		LoanProduct p = rateProduct(1, "3.0");
		ReflectionTestUtils.setField(p, "prepayFeeMax", new BigDecimal("1.2"));
		givenOnProducts(p);

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(new BigDecimal("1.2"), response.getItems().get(0).getPrepayFeeMax());
	}

	@Test
	void 중도상환수수료_정보가_없으면_null이다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertNull(response.getItems().get(0).getPrepayFeeMax());
	}

	@Test
	void product에_상품_요약이_담긴다() {
		// Given
		givenOnProducts(product(7, "튼튼대출", new BigDecimal("3.0"), 1000L, 12, 0L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals("튼튼대출", response.getItems().get(0).getProduct().getProductName());
	}

	@Test
	void 상품에_붙은_태그가_product_tags에_담긴다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		when(productTagRepository.findByProductIdIn(anyCollection())).thenReturn(List.of(productTag(9, 1)));
		when(tagRepository.findByTagIdInOrderByTagId(anyCollection())).thenReturn(List.of(tag(9, "저축은행")));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals("저축은행", response.getItems().get(0).getProduct().getTags().get(0).getTagValue());
	}

	@Test
	void 태그가_없는_상품도_빈_태그_목록으로_담긴다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(0, response.getItems().get(0).getProduct().getTags().size());
	}

	@Test
	void 상품의_태그는_30개_상품_번호로만_조회한다() {
		// Given
		givenManyProducts(35);

		// When
		rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		List<Long> first30 = java.util.stream.LongStream.rangeClosed(1, 30).boxed().toList();
		verify(productTagRepository).findByProductIdIn(eq(first30));
	}

	@Test
	void baseDate는_게시_상품_중_가장_최근_값이다() {
		// Given
		givenOnProducts(product(1, "가", new BigDecimal("3.0"), 1000L, 12, 0L, LocalDateTime.of(2026, 10, 1, 0, 0)),
				product(2, "나", new BigDecimal("4.0"), 1000L, 12, 0L, LocalDateTime.of(2026, 11, 20, 0, 0)),
				product(3, "다", new BigDecimal("5.0"), 1000L, 12, 0L, LocalDateTime.of(2026, 9, 5, 0, 0)));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(LocalDateTime.of(2026, 11, 20, 0, 0), response.getBaseDate());
	}

	@Test
	void baseDate는_cat을_바꿔도_같은_값이다() {
		// Given
		givenOnProducts(product(1, "가", new BigDecimal("3.0"), 1000L, 12, 0L, LocalDateTime.of(2026, 10, 1, 0, 0)),
				product(2, "나", new BigDecimal("4.0"), 1000L, 12, 0L, LocalDateTime.of(2026, 11, 20, 0, 0)));
		when(tagRepository.findByTagTypeAndTagValueIn(eq(TagType.SECTOR), anyList())).thenReturn(List.of(tag(1, "시중은행")));
		when(productTagRepository.findByTagIdIn(any())).thenReturn(List.of(productTag(1, 1)));

		// When
		RankingResponseDTO response = rankingService.getRanking(request("은행권", "rate", "asc"));

		// Then
		assertEquals(LocalDateTime.of(2026, 11, 20, 0, 0), response.getBaseDate());
	}

	@Test
	void 응답의_items는_수정할_수_없다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertThrows(UnsupportedOperationException.class,
				() -> response.getItems().add(new RankingResponseDTO.RankingItem()));
	}

	// ---------- cat 거르기 (RANK-02) ----------

	private void givenSectorProducts(List<Tag> tags, List<ProductTag> productTags) {
		when(tagRepository.findByTagTypeAndTagValueIn(eq(TagType.SECTOR), anyList())).thenReturn(tags);
		when(productTagRepository.findByTagIdIn(any())).thenReturn(productTags);
	}

	@Test
	void 은행권을_고르면_은행권_세분류_4개의_SECTOR_태그를_찾는다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		rankingService.getRanking(request("은행권", "rate", "asc"));

		// Then
		verify(tagRepository).findByTagTypeAndTagValueIn(TagType.SECTOR,
				List.of("시중은행", "지방은행", "특수은행", "인터넷은행"));
	}

	@Test
	void 비은행권을_고르면_비은행권_세분류_6개의_SECTOR_태그를_찾는다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		rankingService.getRanking(request("비은행권", "rate", "asc"));

		// Then
		verify(tagRepository).findByTagTypeAndTagValueIn(TagType.SECTOR,
				List.of("저축은행", "캐피탈", "생명보험", "신협", "카드사", "손해보험"));
	}

	@Test
	void 정책금융을_고르면_정책금융_세분류_7개의_SECTOR_태그를_찾는다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		rankingService.getRanking(request("정책금융", "rate", "asc"));

		// Then
		verify(tagRepository).findByTagTypeAndTagValueIn(TagType.SECTOR,
				List.of("신용보증재단", "서민금융기관", "공공기관", "지자체", "협약 금융회사", "복지기관", "기타"));
	}

	@Test
	void cat을_고르면_그_금융권_태그를_가진_상품만_남긴다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"), rateProduct(2, "4.0"), rateProduct(3, "5.0"));
		givenSectorProducts(List.of(tag(10, "시중은행"), tag(11, "지방은행")),
				List.of(productTag(10, 1), productTag(11, 3)));

		// When
		RankingResponseDTO response = rankingService.getRanking(request("은행권", "rate", "asc"));

		// Then
		assertEquals(List.of(1L, 3L), idsOf(response));
	}

	@Test
	void 여러_세분류_태그를_가진_상품도_한_번만_나온다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"), rateProduct(2, "4.0"));
		givenSectorProducts(List.of(tag(10, "시중은행"), tag(11, "지방은행")),
				List.of(productTag(10, 1), productTag(11, 1)));

		// When
		RankingResponseDTO response = rankingService.getRanking(request("은행권", "rate", "asc"));

		// Then
		assertEquals(List.of(1L), idsOf(response));
	}

	@Test
	void cat으로_거른_뒤에_정렬하고_30개를_자른다() {
		// Given
		List<LoanProduct> products = new ArrayList<>();
		List<ProductTag> productTags = new ArrayList<>();
		for (int i = 1; i <= 40; i++) {
			products.add(rateProduct(i, i + ".0"));
			if (i > 5) {
				productTags.add(productTag(10, i)); // 6번부터 40번까지 35개만 은행권
			}
		}
		when(loanProductRepository.findByProductStatus(ProductStatus.ON)).thenReturn(products);
		givenSectorProducts(List.of(tag(10, "시중은행")), productTags);

		// When
		RankingResponseDTO response = rankingService.getRanking(request("은행권", "rate", "asc"));

		// Then
		assertEquals(30, response.getItems().size());
		assertEquals(6L, response.getItems().get(0).getProduct().getProductId());
	}

	@Test
	void 그_금융권_상품이_없으면_전체가_아니라_0건이다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"), rateProduct(2, "4.0"));
		givenSectorProducts(List.of(tag(10, "시중은행")), List.of());

		// When
		RankingResponseDTO response = rankingService.getRanking(request("은행권", "rate", "asc"));

		// Then
		assertEquals(0, response.getItems().size());
	}

	@Test
	void 그_금융권_태그가_DB에_없으면_0건이다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		givenSectorProducts(List.of(), List.of());

		// When
		RankingResponseDTO response = rankingService.getRanking(request("은행권", "rate", "asc"));

		// Then
		assertEquals(0, response.getItems().size());
	}

	@Test
	void 그_금융권_태그가_DB에_없으면_상품_연결을_조회하지_않는다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		givenSectorProducts(List.of(), List.of());

		// When
		rankingService.getRanking(request("은행권", "rate", "asc"));

		// Then
		verify(productTagRepository, never()).findByTagIdIn(any());
	}

	@Test
	void cat이_null이면_전체이고_태그를_조회하지_않는다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"), rateProduct(2, "4.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(2, response.getItems().size());
		verify(tagRepository, never()).findByTagTypeAndTagValueIn(any(), anyList());
	}

	@Test
	void cat이_빈_값이면_전체이다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"), rateProduct(2, "4.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request("", "rate", "asc"));

		// Then
		assertEquals(2, response.getItems().size());
	}

	@Test
	void cat이_공백만_있으면_전체이다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"), rateProduct(2, "4.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request("   ", "rate", "asc"));

		// Then
		assertEquals(2, response.getItems().size());
	}

	@Test
	void cat_앞뒤_공백은_무시하고_대분류로_본다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		rankingService.getRanking(request(" 은행권 ", "rate", "asc"));

		// Then
		verify(tagRepository).findByTagTypeAndTagValueIn(TagType.SECTOR,
				List.of("시중은행", "지방은행", "특수은행", "인터넷은행"));
	}

	// ---------- 메모리 캐시 (B10) ----------

	@Test
	void 같은_조합을_두_번_부르면_DB는_한_번만_읽는다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		rankingService.getRanking(request(null, "rate", "asc"));

		// When
		rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		verify(loanProductRepository, times(1)).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void 캐시에서_꺼내면_같은_응답_객체이다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		RankingResponseDTO first = rankingService.getRanking(request(null, "rate", "asc"));

		// When
		RankingResponseDTO second = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertSame(first, second);
	}

	@Test
	void 응답은_RANKING_칸에_cat_metric_dir_키로_저장된다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertSame(response, memoryCache.get(MemoryCache.RANKING, "|rate|asc"));
	}

	@Test
	void metric이_다르면_따로_계산한다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		rankingService.getRanking(request(null, "rate", "asc"));

		// When
		rankingService.getRanking(request(null, "limit", "asc"));

		// Then
		verify(loanProductRepository, times(2)).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void dir이_다르면_따로_계산한다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		rankingService.getRanking(request(null, "rate", "asc"));

		// When
		rankingService.getRanking(request(null, "rate", "desc"));

		// Then
		verify(loanProductRepository, times(2)).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void cat이_다르면_따로_계산한다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		rankingService.getRanking(request("은행권", "rate", "asc"));

		// When
		rankingService.getRanking(request("비은행권", "rate", "asc"));

		// Then
		verify(loanProductRepository, times(2)).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void cat이_null_빈_값_공백이어도_같은_조합으로_본다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		rankingService.getRanking(request(null, "rate", "asc"));

		// When
		rankingService.getRanking(request("", "rate", "asc"));
		rankingService.getRanking(request("   ", "rate", "asc"));

		// Then
		verify(loanProductRepository, times(1)).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void 캐시_hit이면_태그_조회도_하지_않는다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		givenSectorProducts(List.of(tag(10, "시중은행")), List.of(productTag(10, 1)));
		rankingService.getRanking(request("은행권", "rate", "asc"));

		// When
		rankingService.getRanking(request("은행권", "rate", "asc"));

		// Then
		verify(tagRepository, times(1)).findByTagTypeAndTagValueIn(eq(TagType.SECTOR), anyList());
	}

	@Test
	void 상품_캐시를_비우면_다시_계산한다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		rankingService.getRanking(request(null, "rate", "asc"));
		memoryCache.clearProductCaches();

		// When
		rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		verify(loanProductRepository, times(2)).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void 상품이_바뀌어_캐시를_비우면_새_값으로_응답한다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		rankingService.getRanking(request(null, "rate", "asc"));
		givenOnProducts(rateProduct(1, "3.0"), rateProduct(2, "2.0"));
		memoryCache.clearProductCaches();

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertEquals(List.of(2L, 1L), idsOf(response));
	}

	@Test
	void 잘못된_값은_캐시에_저장되지_않는다() {
		// Given, When
		invalid(() -> rankingService.getRanking(request(null, "abc", "asc")));

		// Then
		assertNull(memoryCache.get(MemoryCache.RANKING, "|abc|asc"));
	}

	@Test
	void 인기순_views는_같은_조합을_두_번_불러도_매번_계산한다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		rankingService.getRanking(request(null, "views", "desc"));

		// When
		rankingService.getRanking(request(null, "views", "desc"));

		// Then
		verify(loanProductRepository, times(2)).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void 인기순_views는_캐시에_저장하지_않는다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));

		// When
		rankingService.getRanking(request(null, "views", "desc"));

		// Then
		assertNull(memoryCache.get(MemoryCache.RANKING, "|views|desc"));
	}

	@Test
	void 인기순_views는_조회수가_바뀌면_바로_새_순위가_나온다() {
		// Given
		givenOnProducts(product(1, "가", null, 1000L, 12, 10L), product(2, "나", null, 1000L, 12, 5L));
		rankingService.getRanking(request(null, "views", "desc"));
		givenOnProducts(product(1, "가", null, 1000L, 12, 10L), product(2, "나", null, 1000L, 12, 50L));

		// When
		RankingResponseDTO response = rankingService.getRanking(request(null, "views", "desc"));

		// Then
		assertEquals(List.of(2L, 1L), idsOf(response));
	}

	@Test
	void 인기순이_아닌_metric은_계속_캐시한다() {
		// Given
		givenOnProducts(rateProduct(1, "3.0"));
		rankingService.getRanking(request(null, "limit", "desc"));

		// When
		rankingService.getRanking(request(null, "limit", "desc"));

		// Then
		verify(loanProductRepository, times(1)).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void 빈_결과도_캐시에_저장된다() {
		// Given
		when(loanProductRepository.findByProductStatus(ProductStatus.ON)).thenReturn(List.of());

		// When
		rankingService.getRanking(request(null, "rate", "asc"));

		// Then
		assertNotNull(memoryCache.get(MemoryCache.RANKING, "|rate|asc"));
	}
}
