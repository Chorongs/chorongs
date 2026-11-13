package chorong.recommend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.BeanUtils;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.test.util.ReflectionTestUtils;

import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.LoanType;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.RateKind;
import chorong.product.entity.Source;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductRateRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.recommend.dto.EligibilityResponseDTO;
import chorong.recommend.dto.RecommendItemDTO;
import chorong.recommend.dto.RecommendRequestDTO;
import chorong.recommend.dto.RecommendResponseDTO;

/*
 * RecommendServiceImpl 테스트 (LOAN-01, 02, 05)
 * DB 대신 Mockito 가짜 Repository, 판정은 진짜 RecommendRule과 MemoryCache
 * 기획서 7-1 시나리오 1, 5, 8, 9, 10, 11, 12, 16 포함
 */
@ExtendWith(OutputCaptureExtension.class)
class RecommendServiceImplTest {

	private LoanProductRepository loanProductRepository;
	private TagRepository tagRepository;
	private ProductTagRepository productTagRepository;
	private ProductRateRepository productRateRepository;
	private RecommendServiceImpl recommendService;

	// 모든 상품이 같이 쓰는 태그 (생활비, 전월세, 제한 없음, 전국, 신용 무관)
	private final List<Tag> tags = List.of(
			tag(1, TagType.PURPOSE, "생활비"),
			tag(2, TagType.PURPOSE, "전월세"),
			tag(3, TagType.TARGET, "제한 없음"),
			tag(4, TagType.REGION, "전국"),
			tag(5, TagType.CREDIT, "신용 무관"));

	@BeforeEach
	void setUp() {
		loanProductRepository = mock(LoanProductRepository.class);
		tagRepository = mock(TagRepository.class);
		productTagRepository = mock(ProductTagRepository.class);
		productRateRepository = mock(ProductRateRepository.class);
		RecommendRule rule = new RecommendRule(0.2, 0.3, 0.1, 0.6, 0.4, 40, 30);
		recommendService = new RecommendServiceImpl(loanProductRepository, tagRepository, productTagRepository,
				productRateRepository, new MemoryCache(), rule);
		when(tagRepository.findAll()).thenReturn(tags);
		when(productRateRepository.findByRateKind(RateKind.CREDIT)).thenReturn(List.of());
	}

	// ---- 테스트 데이터 ----

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

	// 게시 상품: 금리 rate ~ rate + 1%, 한도 5,000만원, 최대 120개월
	private static LoanProduct product(long id, String rate) {
		LoanProduct product = BeanUtils.instantiateClass(LoanProduct.class);
		set(product, "productId", id);
		set(product, "source", Source.KINFA);
		set(product, "loanType", LoanType.KINFA);
		set(product, "companyName", "기관" + id);
		set(product, "productName", "상품" + id);
		if (rate != null) {
			set(product, "rateMin", new BigDecimal(rate));
			set(product, "rateMax", new BigDecimal(rate).add(BigDecimal.ONE));
		}
		set(product, "limitAmount", 5000L);
		set(product, "termMax", 120);
		set(product, "productStatus", ProductStatus.ON);
		return product;
	}

	private static ProductTag productTag(long productId, long tagId) {
		ProductTag productTag = BeanUtils.instantiateClass(ProductTag.class);
		set(productTag, "productId", productId);
		set(productTag, "tagId", tagId);
		return productTag;
	}

	// 상품마다 태그 5개를 모두 연결해 게시 상품으로 등록
	private void givenProducts(List<LoanProduct> products) {
		List<ProductTag> links = new ArrayList<>();
		for (LoanProduct product : products) {
			for (Tag tag : tags) {
				links.add(productTag(product.getProductId(), tag.getTagId()));
			}
		}
		when(loanProductRepository.findByProductStatus(ProductStatus.ON)).thenReturn(products);
		when(productTagRepository.findAll()).thenReturn(links);
	}

	// 금리가 서로 다른 상품 n개 (1번이 가장 낮음)
	private void givenProducts(int count) {
		List<LoanProduct> products = new ArrayList<>();
		for (int i = 1; i <= count; i++) {
			products.add(product(i, String.valueOf(3 + i * 0.1).substring(0, 3)));
		}
		givenProducts(products);
	}

	// 기본 입력: 직장인, 35세 이상, 서울, 연소득 4,000만원, 생활비 1,000만원 36개월, 701~800, 낮은 금리
	private static RecommendRequestDTO request() {
		return new RecommendRequestDTO("OFFICE", "ADULT", "서울", 4000, 0, false, "생활비", 1000, 36, "BAND3", false,
				List.of("LOW_RATE"));
	}

	// ---- 결과 ----

	@Test
	void 시나리오1_결과는_최대_30개() {
		// Given
		givenProducts(35);

		// When
		RecommendResponseDTO response = recommendService.getRecommendations(request(), null);

		// Then
		assertEquals(30, response.getItems().size());
	}

	@Test
	void total은_30개로_자르기_전_남은_상품_수() {
		// Given
		givenProducts(35);

		// When
		RecommendResponseDTO response = recommendService.getRecommendations(request(), null);

		// Then
		assertEquals(35, response.getTotal());
	}

	@Test
	void 시나리오1_일치도_높은_순으로_정렬() {
		// Given
		givenProducts(10);

		// When
		List<RecommendItemDTO> items = recommendService.getRecommendations(request(), null).getItems();

		// Then
		for (int i = 1; i < items.size(); i++) {
			assertTrue(items.get(i - 1).getMatchRate().compareTo(items.get(i).getMatchRate()) >= 0);
		}
	}

	@Test
	void 일치도가_같으면_예상_금리_낮은_순() {
		// Given: 같은 금리 묶음 없이 고른 기준 '비대면'(모두 모름 0.5)이면 일치도가 같음
		givenProducts(List.of(product(1, "7.0"), product(2, "4.0")));
		RecommendRequestDTO request = request();
		request.setPriorities(List.of("ONLINE"));

		// When
		List<RecommendItemDTO> items = recommendService.getRecommendations(request, null).getItems();

		// Then
		assertEquals(2L, items.get(0).getProduct().getProductId());
	}

	@Test
	void 시나리오12_금리_없는_상품만_남아도_순위에_들어감() {
		// Given
		givenProducts(List.of(product(1, null)));

		// When
		List<RecommendItemDTO> items = recommendService.getRecommendations(request(), null).getItems();

		// Then
		assertEquals(1, items.size());
	}

	@Test
	void 후보_중_최저_금리는_판단_태그() {
		// Given
		givenProducts(3);

		// When
		RecommendItemDTO first = recommendService.getRecommendations(request(), null).getItems().get(0);

		// Then
		assertTrue(first.getJudgeTags().contains("후보 중 최저 금리"));
	}

	// ---- 0건 ----

	// 모든 상품이 신용 801~1000점 기준 (701~800이면 모두 제외, 한 칸 높으면 통과)
	private void givenHighCreditProducts() {
		List<LoanProduct> products = List.of(product(1, "5.0"), product(2, "6.0"));
		for (LoanProduct product : products) {
			set(product, "creditMin", 801);
			set(product, "creditMax", 1000);
		}
		List<ProductTag> links = new ArrayList<>();
		for (LoanProduct product : products) {
			for (long tagId = 1; tagId <= 4; tagId++) {	// 신용 무관 태그는 빼고 연결
				links.add(productTag(product.getProductId(), tagId));
			}
		}
		when(loanProductRepository.findByProductStatus(ProductStatus.ON)).thenReturn(products);
		when(productTagRepository.findAll()).thenReturn(links);
	}

	@Test
	void 시나리오11_조건에_맞는_상품이_없으면_total_0() {
		// Given
		givenHighCreditProducts();

		// When
		RecommendResponseDTO response = recommendService.getRecommendations(request(), null);

		// Then
		assertEquals(0, response.getTotal());
	}

	@Test
	void 시나리오11_0건이면_찾지_못했어요_안내() {
		// Given
		givenHighCreditProducts();

		// When
		RecommendResponseDTO response = recommendService.getRecommendations(request(), null);

		// Then
		assertEquals("조건에 맞는 상품을 찾지 못했어요", response.getNotes().get(0));
	}

	@Test
	void 시나리오11_제외_요약은_사유와_개수() {
		// Given
		givenHighCreditProducts();

		// When
		RecommendResponseDTO response = recommendService.getRecommendations(request(), null);

		// Then
		assertEquals(new RecommendResponseDTO.ExcludedItem("신용점수 기준에 맞지 않는 상품", 2), response.getExcluded().get(0));
	}

	@Test
	void 시나리오11_hint는_신용_구간이_한_칸_높으면_N개() {
		// Given
		givenHighCreditProducts();

		// When
		RecommendResponseDTO response = recommendService.getRecommendations(request(), null);

		// Then
		assertEquals("신용 구간이 한 칸 높으면 2개", response.getHint());
	}

	// ---- 안내 문구 ----

	@Test
	void 시나리오5_연체면_결과_위_안내() {
		// Given
		givenProducts(1);
		RecommendRequestDTO request = request();
		request.setOverdue(true);

		// When
		List<String> notes = recommendService.getRecommendations(request, null).getNotes();

		// Then
		assertTrue(notes.contains("최근 1년 안에 연체가 있으면 금융회사 심사에서 승인이 어려울 수 있어요"));
	}

	@Test
	void 시나리오5_연체면_모든_상품에_연체_주의() {
		// Given
		givenProducts(3);
		RecommendRequestDTO request = request();
		request.setOverdue(true);

		// When
		List<RecommendItemDTO> items = recommendService.getRecommendations(request, null).getItems();

		// Then
		assertTrue(items.stream().allMatch(item -> item.getJudgeTags().contains("연체 주의")));
	}

	@Test
	void 시나리오8_기존_대출_모름이면_정확도_안내() {
		// Given
		givenProducts(1);
		RecommendRequestDTO request = request();
		request.setDebtMonthly(null);
		request.setDebtUnknown(true);

		// When
		List<String> notes = recommendService.getRecommendations(request, null).getNotes();

		// Then
		assertTrue(notes.contains("기존 대출 정보가 없어서 정확도가 낮아요"));
	}

	@Test
	void 시나리오9_전월세_기간_모름이면_10년_기준_안내() {
		// Given
		givenProducts(1);
		RecommendRequestDTO request = request();
		request.setPurpose("전월세");
		request.setMonths(0);

		// When
		List<String> notes = recommendService.getRecommendations(request, null).getNotes();

		// Then
		assertTrue(notes.contains("10년 기준으로 계산했어요"));
	}

	@Test
	void 회원_생년월일_나이가_고른_나이와_다르면_안내() {
		// Given: 20살 회원이 '35세 이상'을 고름
		givenProducts(1);
		String birthYear = String.valueOf(LocalDate.now().getYear() - 20);
		LoginMemberDTO member = new LoginMemberDTO(1L, "회원", birthYear, "01-01");

		// When
		List<String> notes = recommendService.getRecommendations(request(), member).getNotes();

		// Then
		assertTrue(notes.contains("회원 생년월일로 확인했어요"));
	}

	// ---- 입력 검사 (B2) ----

	@Test
	void 시나리오10_생활비에_180개월이면_400() {
		// Given
		RecommendRequestDTO request = request();
		request.setMonths(180);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> recommendService.getRecommendations(request, null));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 고른_기준이_중복이면_400() {
		// Given
		RecommendRequestDTO request = request();
		request.setPriorities(List.of("LOW_RATE", "LOW_RATE"));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> recommendService.getRecommendations(request, null));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 기존_대출을_모르지_않는데_값이_없으면_400() {
		// Given
		RecommendRequestDTO request = request();
		request.setDebtMonthly(null);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> recommendService.getRecommendations(request, null));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	// ---- 후보, 캐시 ----

	@Test
	void 게시_상품이_아예_없으면_500() {
		// Given
		givenProducts(List.of());

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> recommendService.getRecommendations(request(), null));

		// Then
		assertEquals(ErrorCode.SERVER_ERROR, e.getErrorCode());
	}

	@Test
	void 두번째_요청은_캐시의_후보를_씀() {
		// Given
		givenProducts(3);
		recommendService.getRecommendations(request(), null);

		// When
		recommendService.getRecommendations(request(), null);

		// Then
		verify(loanProductRepository, times(1)).findByProductStatus(ProductStatus.ON);
	}

	@Test
	void 시나리오16_추천_요청은_DB에_저장하지_않음() {
		// Given
		givenProducts(3);

		// When
		recommendService.getRecommendations(request(), null);

		// Then
		verify(loanProductRepository, never()).save(any());
	}

	@Test
	void 시나리오16_추천_입력값은_로그에_남기지_않음(CapturedOutput output) {
		// Given: 다른 로그와 겹치지 않는 연소득 값
		givenProducts(3);
		RecommendRequestDTO request = request();
		request.setIncome(98765);

		// When
		recommendService.getRecommendations(request, null);

		// Then
		assertFalse(output.getAll().contains("98765"));
	}

	// ---- 내 조건 판정 (LOAN-05) ----

	@Test
	void 판정_게시_상품이_아니면_404() {
		// Given
		givenProducts(1);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> recommendService.getEligibility(999L, request(), null));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 판정_제외면_FAIL과_그_사유() {
		// Given: 한도 500만원 상품에 1,000만원
		LoanProduct product = product(1, "5.0");
		set(product, "limitAmount", 500L);
		givenProducts(List.of(product));

		// When
		EligibilityResponseDTO response = recommendService.getEligibility(1L, request(), null);

		// Then
		assertEquals(List.of("한도가 필요 금액보다 작아요"), response.getReasons());
	}

	@Test
	void 판정_모두_충족이면_PASS() {
		// Given
		givenProducts(1);

		// When
		EligibilityResponseDTO response = recommendService.getEligibility(1L, request(), null);

		// Then
		assertEquals("PASS", response.getResult());
	}
}
