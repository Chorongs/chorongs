package chorong.search.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

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
import chorong.search.dto.FilterChipResponseDTO;
import chorong.search.dto.KeywordSearchRequestDTO;
import chorong.search.dto.KeywordSearchResponseDTO;
import chorong.search.dto.ProductSearchRequestDTO;
import chorong.search.dto.ProductSearchResponseDTO;

/*
 * SearchServiceImpl 테스트 (SEARCH-01~03)
 * DB 대신 Mockito 가짜 Repository를 씀. 입력 검사(B19, B2)는 공격 요청이 막히고 상품을 조회하지 않는지 확인
 */
class SearchServiceImplTest {

	private LoanProductRepository loanProductRepository;
	private TagRepository tagRepository;
	private ProductTagRepository productTagRepository;
	private SearchServiceImpl service;

	@BeforeEach
	void setUp() {
		loanProductRepository = mock(LoanProductRepository.class);
		tagRepository = mock(TagRepository.class);
		productTagRepository = mock(ProductTagRepository.class);
		service = new SearchServiceImpl(loanProductRepository, tagRepository, productTagRepository, new MemoryCache(),
				new KeywordRule());
	}

	private Tag tag(long id, TagType type, String value) {
		Tag tag = mock(Tag.class);
		when(tag.getTagId()).thenReturn(id);
		when(tag.getTagType()).thenReturn(type);
		when(tag.getTagValue()).thenReturn(value);
		return tag;
	}

	private LoanProduct product(long id, String company, String name, String rateMin) {
		LoanProduct product = mock(LoanProduct.class);
		when(product.getProductId()).thenReturn(id);
		when(product.getCompanyName()).thenReturn(company);
		when(product.getProductName()).thenReturn(name);
		when(product.getProductStatus()).thenReturn(ProductStatus.ON);
		if (rateMin != null) {
			when(product.getRateMin()).thenReturn(new BigDecimal(rateMin));
		}
		return product;
	}

	private void givenTags(Tag... tags) {
		when(tagRepository.findAll()).thenReturn(List.of(tags));
	}

	// 검색 쿼리가 돌려줄 쪽 (전체 건수 total)
	private void givenSearchPage(List<LoanProduct> content, long total) {
		Page<LoanProduct> page = new PageImpl<>(content, PageRequest.of(0, 20), total);
		when(loanProductRepository.searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(), any(), anyLong(),
				anyInt(), any(), any(), any(), any(), any(Pageable.class))).thenReturn(page);
	}

	private ProductSearchRequestDTO request() {
		return new ProductSearchRequestDTO();
	}

	// ---- 입력 검사 (B19, B2): 공격 요청은 400이고 상품을 조회하지 않는다 ----

	@Test
	void 모르는_칩_값이면_400이고_상품을_조회하지_않는다() {
		// Given
		ProductSearchRequestDTO request = request();
		request.setRegion("서울,없는지역");

		// When
		BusinessException error = assertThrows(BusinessException.class, () -> service.searchProducts(request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, error.getErrorCode());
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 대분류_이름은_금융권_값으로_받지_않는다() {
		// Given: 서버에 대분류는 없고 프론트가 세분류 값을 풀어서 보냄
		ProductSearchRequestDTO request = request();
		request.setFin("은행권");

		// When
		BusinessException error = assertThrows(BusinessException.class, () -> service.searchProducts(request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, error.getErrorCode());
	}

	@Test
	void 한_필터에_칩이_20개를_넘으면_400이다() {
		// Given: 서로 다른 값 21개
		List<String> values = new ArrayList<>();
		for (int i = 1; i <= 21; i++) {
			values.add("값" + i);
		}
		ProductSearchRequestDTO request = request();
		request.setPurpose(String.join(",", values));

		// When
		BusinessException error = assertThrows(BusinessException.class, () -> service.searchProducts(request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, error.getErrorCode());
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 모르는_금리_탭_정렬_쪽_크기는_400이다() {
		// Given
		ProductSearchRequestDTO badRt = request();
		badRt.setRt("XXX");
		ProductSearchRequestDTO badSort = request();
		badSort.setSort("name;drop table");
		ProductSearchRequestDTO bigSize = request();
		bigSize.setSize(51);
		ProductSearchRequestDTO zeroPage = request();
		zeroPage.setPage(0);

		// When, Then
		for (ProductSearchRequestDTO bad : List.of(badRt, badSort, bigSize, zeroPage)) {
			BusinessException error = assertThrows(BusinessException.class, () -> service.searchProducts(bad));
			assertEquals(ErrorCode.INVALID_INPUT, error.getErrorCode());
		}
		verifyNoInteractions(loanProductRepository);
	}

	// ---- 필터 규칙 ----

	@Test
	void 지역을_고르면_전국_칩도_같이_찾는다() {
		// Given: 서울(4), 전국(5), 다른 지역(6)
		givenTags(tag(4, TagType.REGION, "서울"), tag(5, TagType.REGION, "전국"), tag(6, TagType.REGION, "부산"));
		givenSearchPage(List.of(), 0);
		ProductSearchRequestDTO request = request();
		request.setRegion("서울");

		// When
		service.searchProducts(request);

		// Then
		ArgumentCaptor<Collection<Long>> tagIds = ArgumentCaptor.forClass(Collection.class);
		ArgumentCaptor<Long> groupCount = ArgumentCaptor.forClass(Long.class);
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(),
				tagIds.capture(), groupCount.capture(), anyInt(), any(), any(), any(), any(), any(Pageable.class));
		assertEquals(2, tagIds.getAllValues().get(0).size());
		assertTrue(tagIds.getAllValues().get(0).containsAll(List.of(4L, 5L)));
		assertEquals(1L, groupCount.getAllValues().get(0));
	}

	@Test
	void 대상과_신용도_같은_방식으로_제한_없음_신용_무관_칩을_더한다() {
		// Given
		givenTags(tag(1, TagType.TARGET, "청년/학생"), tag(2, TagType.TARGET, "제한 없음"),
				tag(3, TagType.CREDIT, "701~800"), tag(4, TagType.CREDIT, "신용 무관"));
		givenSearchPage(List.of(), 0);
		ProductSearchRequestDTO request = request();
		request.setTarget("청년/학생");
		request.setCredit("701~800");

		// When
		service.searchProducts(request);

		// Then: 필터 2개, 칩 4개 모두
		ArgumentCaptor<Collection<Long>> tagIds = ArgumentCaptor.forClass(Collection.class);
		ArgumentCaptor<Long> groupCount = ArgumentCaptor.forClass(Long.class);
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(),
				tagIds.capture(), groupCount.capture(), anyInt(), any(), any(), any(), any(), any(Pageable.class));
		assertTrue(tagIds.getAllValues().get(0).containsAll(List.of(1L, 2L, 3L, 4L)));
		assertEquals(2L, groupCount.getAllValues().get(0));
	}

	@Test
	void 고른_필터의_칩이_DB에_하나도_없으면_상품을_조회하지_않고_빈_결과다() {
		// Given: 서울 칩이 DB에 없음
		givenTags(tag(5, TagType.REGION, "전국"));
		ProductSearchRequestDTO request = request();
		request.setPurpose("생활비");

		// When
		ProductSearchResponseDTO response = service.searchProducts(request);

		// Then
		assertEquals(0, response.getList().size());
		assertEquals(0L, response.getTotal());
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 필터가_없으면_필터_조건_없이_조회한다() {
		// Given
		givenTags(tag(1, TagType.TARGET, "직장인"));
		givenSearchPage(List.of(), 0);

		// When
		service.searchProducts(request());

		// Then: useTags 0, 빈 IN 목록 대신 -1 하나
		ArgumentCaptor<Integer> useTags = ArgumentCaptor.forClass(Integer.class);
		ArgumentCaptor<Collection<Long>> tagIds = ArgumentCaptor.forClass(Collection.class);
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), any(), any(),
				useTags.capture(), tagIds.capture(), anyLong(), anyInt(), any(), any(), any(), any(), any(Pageable.class));
		assertEquals(0, useTags.getAllValues().get(0));
		assertEquals(List.of(-1L), List.copyOf(tagIds.getAllValues().get(0)));
	}

	@Test
	void 검색어는_소문자로_바꿔_보내고_칩_값_검색은_정해진_종류만_본다() {
		// Given: 서울(지원 지역)은 대상이고 1천만원 미만(필요 금액)은 아님. 검색어 '서울' 대신 '미만'으로 확인
		givenTags(tag(1, TagType.REGION, "서울"), tag(2, TagType.AMOUNT, "1천만원 미만"), tag(3, TagType.SECTOR, "시중은행"));
		givenSearchPage(List.of(), 0);
		ProductSearchRequestDTO request = request();
		request.setQ("  서울  ");

		// When
		service.searchProducts(request);

		// Then
		ArgumentCaptor<String> q = ArgumentCaptor.forClass(String.class);
		ArgumentCaptor<Collection<Long>> qTagIds = ArgumentCaptor.forClass(Collection.class);
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), q.capture(),
				qTagIds.capture(), anyInt(), any(), anyLong(), anyInt(), any(), any(), any(), any(), any(Pageable.class));
		assertEquals("서울", q.getAllValues().get(0));
		assertEquals(List.of(1L), List.copyOf(qTagIds.getAllValues().get(0)));
	}

	@Test
	void 필요_금액_칩은_검색어로_찾지_않는다() {
		// Given
		givenTags(tag(2, TagType.AMOUNT, "1천만원 미만"));
		givenSearchPage(List.of(), 0);
		ProductSearchRequestDTO request = request();
		request.setQ("미만");

		// When
		service.searchProducts(request);

		// Then: 찾을 칩이 없어 -1 하나
		ArgumentCaptor<Collection<Long>> qTagIds = ArgumentCaptor.forClass(Collection.class);
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), any(), qTagIds.capture(),
				anyInt(), any(), anyLong(), anyInt(), any(), any(), any(), any(), any(Pageable.class));
		assertEquals(List.of(-1L), List.copyOf(qTagIds.getAllValues().get(0)));
	}

	// ---- 정렬, 금리 탭, 건수 ----

	private Sort firstSort() {
		ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(), any(),
				anyLong(), anyInt(), any(), any(), any(), any(), pageable.capture());
		return pageable.getAllValues().get(0).getSort();
	}

	@Test
	void 기본_정렬은_취급기관_상품명_가나다_순이다() {
		// Given
		givenTags();
		givenSearchPage(List.of(), 0);

		// When
		service.searchProducts(request());

		// Then
		Sort sort = firstSort();
		assertEquals("companyName", sort.toList().get(0).getProperty());
		assertEquals("productName", sort.toList().get(1).getProperty());
	}

	@Test
	void 금리_낮은_순은_금리_없는_상품을_맨_뒤로_보낸다() {
		// Given
		givenTags();
		givenSearchPage(List.of(), 0);
		ProductSearchRequestDTO request = request();
		request.setSort("rate");

		// When
		service.searchProducts(request);

		// Then
		Sort.Order first = firstSort().toList().get(0);
		assertEquals("rateMin", first.getProperty());
		assertEquals(Sort.NullHandling.NULLS_LAST, first.getNullHandling());
	}

	@Test
	void 금리_기관_문의_탭에서_금리순이_오면_기본_순으로_바꾼다() {
		// Given
		givenTags();
		givenSearchPage(List.of(), 0);
		ProductSearchRequestDTO request = request();
		request.setRt("MEMO");
		request.setSort("rate");

		// When
		service.searchProducts(request);

		// Then
		assertEquals("companyName", firstSort().toList().get(0).getProperty());
	}

	@Test
	void 건수는_금리_탭에_따라_안내_건수와_문의_건수로_나눠_응답한다() {
		// Given: 금리 표시 탭(NUM) 결과 7건, 다른 탭(MEMO) 3건
		givenTags();
		when(loanProductRepository.searchProducts(any(), org.mockito.ArgumentMatchers.eq(1), anyInt(), any(), any(),
				anyInt(), any(), anyLong(), anyInt(), any(), any(), any(), any(), any(Pageable.class)))
				.thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 7));
		when(loanProductRepository.searchProducts(any(), org.mockito.ArgumentMatchers.eq(2), anyInt(), any(), any(),
				anyInt(), any(), anyLong(), anyInt(), any(), any(), any(), any(), any(Pageable.class)))
				.thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 1), 3));

		// When
		ProductSearchResponseDTO response = service.searchProducts(request());

		// Then
		assertEquals(7L, response.getTotal());
		assertEquals(7, response.getNumCount());
		assertEquals(3, response.getMemoCount());
		assertEquals(1, response.getPage());
		assertEquals(20, response.getSize());
	}

	@Test
	void 상품은_칩과_함께_한_줄로_바꿔_응답한다() {
		// Given
		Tag seoul = tag(1, TagType.REGION, "서울");
		givenTags(seoul);
		LoanProduct product = product(100, "다함은행", "근로자 대출", "3.00");
		givenSearchPage(List.of(product), 1);
		ProductTag link = mock(ProductTag.class);
		when(link.getProductId()).thenReturn(100L);
		when(link.getTagId()).thenReturn(1L);
		when(productTagRepository.findByProductIdIn(any())).thenReturn(List.of(link));

		// When
		ProductSearchResponseDTO response = service.searchProducts(request());

		// Then
		assertEquals(1, response.getList().size());
		assertEquals("근로자 대출", response.getList().get(0).getProductName());
		assertEquals("서울", response.getList().get(0).getTags().get(0).getTagValue());
	}

	// ---- 필터 칩 목록 (SEARCH-03) ----

	private void givenChipData() {
		givenTags(tag(1, TagType.SECTOR, "시중은행"), tag(2, TagType.SECTOR, "지방은행"), tag(3, TagType.SECTOR, "저축은행"),
				tag(4, TagType.REGION, "서울"), tag(5, TagType.REGION, "전국"), tag(6, TagType.REGION, "부산"));
		// 상품 100: 시중은행, 지방은행, 서울 / 상품 101: 시중은행, 전국 / 상품 102: 저축은행 / 부산은 상품 없음
		List<Object[]> pairs = new ArrayList<>();
		pairs.add(new Object[] { 1L, 100L });
		pairs.add(new Object[] { 2L, 100L });
		pairs.add(new Object[] { 4L, 100L });
		pairs.add(new Object[] { 1L, 101L });
		pairs.add(new Object[] { 5L, 101L });
		pairs.add(new Object[] { 3L, 102L });
		when(productTagRepository.findTagPairsByProductStatus(ProductStatus.ON)).thenReturn(pairs);
	}

	private FilterChipResponseDTO.FilterItem filter(FilterChipResponseDTO response, String key) {
		return response.getFilters().stream().filter(item -> item.getKey().equals(key)).findFirst().orElseThrow();
	}

	@Test
	void 필터는_8개이고_상품_수가_0인_칩은_뺀다() {
		// Given
		givenChipData();

		// When
		FilterChipResponseDTO response = service.getFilterChips();

		// Then
		assertEquals(8, response.getFilters().size());
		assertEquals(List.of("전국", "서울"),
				filter(response, "region").getChips().stream().map(FilterChipResponseDTO.ChipItem::getValue).toList());
	}

	@Test
	void 칩_순서는_고정_표_순서이고_칩마다_상품_수가_붙는다() {
		// Given
		givenChipData();

		// When
		FilterChipResponseDTO.FilterItem fin = filter(service.getFilterChips(), "fin");

		// Then: 시중은행, 지방은행, 저축은행 (고정 표 순서), 시중은행은 상품 2개
		assertEquals(List.of("시중은행", "지방은행", "저축은행"),
				fin.getChips().stream().map(FilterChipResponseDTO.ChipItem::getValue).toList());
		assertEquals(2, fin.getChips().get(0).getCount());
	}

	@Test
	void 금융권_대분류는_소속_세분류와_함께_오고_상품은_한_번만_센다() {
		// Given
		givenChipData();

		// When
		List<FilterChipResponseDTO.GroupItem> groups = filter(service.getFilterChips(), "fin").getGroups();

		// Then: 은행권 = 시중은행 + 지방은행 (상품 100은 둘 다 있어도 1번), 비은행권 = 저축은행, 정책금융은 상품 없어 안 옴
		assertEquals(2, groups.size());
		assertEquals("은행권", groups.get(0).getValue());
		assertEquals(List.of("시중은행", "지방은행"), groups.get(0).getMembers());
		assertEquals(2, groups.get(0).getCount());
		assertEquals("비은행권", groups.get(1).getValue());
		assertEquals(1, groups.get(1).getCount());
	}

	@Test
	void 값이_없는_필터는_빈_칩_목록이다() {
		// Given
		givenChipData();

		// When
		FilterChipResponseDTO.FilterItem purpose = filter(service.getFilterChips(), "purpose");

		// Then
		assertTrue(purpose.getChips().isEmpty());
		assertTrue(purpose.getGroups().isEmpty());
	}

	@Test
	void 칩_목록은_캐시에_있으면_다시_조회하지_않는다() {
		// Given
		givenChipData();

		// When
		service.getFilterChips();
		service.getFilterChips();

		// Then
		verify(productTagRepository, times(1)).findTagPairsByProductStatus(ProductStatus.ON);
	}

	// ---- 간편 검색 (SEARCH-02) ----

	private KeywordSearchRequestDTO keywords(String... values) {
		return new KeywordSearchRequestDTO(Arrays.asList(values), null);
	}

	private void givenKeywordData(LoanProduct... products) {
		when(loanProductRepository.findByProductStatus(ProductStatus.ON)).thenReturn(List.of(products));
		when(productTagRepository.findAll()).thenReturn(List.of());
		givenTags();
	}

	@Test
	void 모르는_키워드와_6개_이상은_400이고_상품을_조회하지_않는다() {
		// Given, When, Then
		BusinessException unknown = assertThrows(BusinessException.class,
				() -> service.searchKeywords(keywords("사회초년생", "없는키워드")));
		BusinessException six = assertThrows(BusinessException.class,
				() -> service.searchKeywords(keywords("사회초년생", "대학생", "프리랜서", "자영업자", "신용점수 낮음", "낮은 금리")));
		BusinessException empty = assertThrows(BusinessException.class, () -> service.searchKeywords(keywords()));
		BusinessException withNull = assertThrows(BusinessException.class,
				() -> service.searchKeywords(keywords("사회초년생", null)));
		assertEquals(ErrorCode.INVALID_INPUT, unknown.getErrorCode());
		assertEquals(ErrorCode.INVALID_INPUT, six.getErrorCode());
		assertEquals(ErrorCode.INVALID_INPUT, empty.getErrorCode());
		assertEquals(ErrorCode.INVALID_INPUT, withNull.getErrorCode());
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 같은_키워드를_여러_번_보내면_하나로_센다() {
		// Given: 같은 키워드 6번은 중복을 빼면 1개
		LoanProduct product = product(1, "가은행", "A", "3.0");
		when(product.getOnlineYn()).thenReturn("Y");
		givenKeywordData(product);

		// When
		KeywordSearchResponseDTO response = service
				.searchKeywords(keywords("비대면", "비대면", "비대면", "비대면", "비대면", "비대면"));

		// Then
		assertEquals(1, response.getItems().size());
		assertEquals(1, response.getItems().get(0).getMatchedCount());
	}

	@Test
	void 충족_키워드_많은_순으로_정렬하고_1위가_못_맞춘_키워드를_알려_준다() {
		// Given: A는 비대면, 낮은 금리 둘 다 / B는 비대면만 / C는 금리 숫자가 없어 후보가 아님
		LoanProduct a = product(1, "가은행", "A상품", "3.5");
		when(a.getOnlineYn()).thenReturn("Y");
		LoanProduct b = product(2, "나은행", "B상품", "6.0");
		when(b.getOnlineYn()).thenReturn("Y");
		LoanProduct c = product(3, "다은행", "C상품", null);
		when(c.getOnlineYn()).thenReturn("Y");
		givenKeywordData(b, a, c);

		// When
		KeywordSearchResponseDTO response = service.searchKeywords(keywords("비대면", "낮은 금리", "큰 한도"));

		// Then
		assertEquals(2, response.getItems().size());
		assertEquals("A상품", response.getItems().get(0).getProduct().getProductName());
		assertEquals(List.of("비대면 신청", "최저 3.5%"), response.getItems().get(0).getReasons());
		assertEquals("B상품", response.getItems().get(1).getProduct().getProductName());
		assertEquals(List.of("큰 한도"), response.getMissedKeywords());
	}

	@Test
	void 충족_수가_같으면_최저_금리_낮은_순이다() {
		// Given
		LoanProduct high = product(1, "가은행", "A상품", "4.0");
		when(high.getOnlineYn()).thenReturn("Y");
		LoanProduct low = product(2, "나은행", "B상품", "2.0");
		when(low.getOnlineYn()).thenReturn("Y");
		givenKeywordData(high, low);

		// When
		KeywordSearchResponseDTO response = service.searchKeywords(keywords("비대면"));

		// Then
		assertEquals("B상품", response.getItems().get(0).getProduct().getProductName());
		assertEquals("A상품", response.getItems().get(1).getProduct().getProductName());
	}

	@Test
	void 충족하는_상품이_없으면_빈_목록이고_오류가_아니다() {
		// Given
		givenKeywordData(product(1, "가은행", "A상품", "3.0"));

		// When
		KeywordSearchResponseDTO response = service.searchKeywords(keywords("창업 준비"));

		// Then
		assertTrue(response.getItems().isEmpty());
		assertTrue(response.getMissedKeywords().isEmpty());
	}

	@Test
	void 결과는_최대_5개다() {
		// Given
		List<LoanProduct> products = new ArrayList<>();
		for (int i = 1; i <= 7; i++) {
			LoanProduct product = product(i, "은행" + i, "상품" + i, "3.0");
			when(product.getOnlineYn()).thenReturn("Y");
			products.add(product);
		}
		givenKeywordData(products.toArray(new LoanProduct[0]));

		// When
		KeywordSearchResponseDTO response = service.searchKeywords(keywords("비대면"));

		// Then
		assertEquals(5, response.getItems().size());
	}

	// ---- 비교함 기준 cmp (요청서 A): 서버가 자금 용도 겹침 + 상환 방식 겹침으로 거름 ----

	private ProductTag link(long productId, long tagId) {
		ProductTag link = mock(ProductTag.class);
		when(link.getProductId()).thenReturn(productId);
		when(link.getTagId()).thenReturn(tagId);
		return link;
	}

	// 칩 마스터: 1 생활비, 2 전월세 (자금 용도) / 3 원리금균등, 4 원금균등, 5 만기일시, 6 기타 (상환 방법)
	private void givenCmpTags() {
		givenTags(tag(1, TagType.PURPOSE, "생활비"), tag(2, TagType.PURPOSE, "전월세"), tag(3, TagType.REPAY, "원리금균등"),
				tag(4, TagType.REPAY, "원금균등"), tag(5, TagType.REPAY, "만기일시"), tag(6, TagType.REPAY, "기타"));
	}

	// 기준 상품 (게시 ON)과 그 상품의 칩
	private void givenBaseProduct(long productId, ProductStatus status, ProductTag... links) {
		LoanProduct base = product(productId, "기준은행", "기준 상품", "3.0");
		when(base.getProductStatus()).thenReturn(status);
		when(loanProductRepository.findById(productId)).thenReturn(Optional.of(base));
		when(productTagRepository.findByProductIdIn(any())).thenReturn(List.of(links));
	}

	// 검색 쿼리: 비교함 기준을 쓰면 건수 4, 안 쓰면 10 (숨긴 수 6)
	private void givenCountsByCmp() {
		when(loanProductRepository.searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(), any(), anyLong(),
				anyInt(), any(), any(), any(), any(), any(Pageable.class)))
				.thenAnswer(call -> new PageImpl<LoanProduct>(List.of(), PageRequest.of(0, 20),
						(int) call.getArgument(8) == 1 ? 4 : 10));
	}

	private ProductSearchRequestDTO cmpRequest(String cmp) {
		ProductSearchRequestDTO request = request();
		request.setCmp(cmp);
		return request;
	}

	@Test
	void cmp가_숫자가_아니거나_3개_이상이면_400이고_상품을_조회하지_않는다() {
		// Given, When, Then
		for (String bad : List.of("abc", "1,2,3", "1,,2", "1,x", "-1")) {
			BusinessException error = assertThrows(BusinessException.class, () -> service.searchProducts(cmpRequest(bad)));
			assertEquals(ErrorCode.INVALID_INPUT, error.getErrorCode());
		}
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 간편_검색도_cmp가_숫자가_아니면_400이다() {
		// Given
		KeywordSearchRequestDTO request = new KeywordSearchRequestDTO(List.of("비대면"), "1,2,3");

		// When
		BusinessException error = assertThrows(BusinessException.class, () -> service.searchKeywords(request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, error.getErrorCode());
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void cmp가_없으면_거르지_않고_숨긴_수는_0이다() {
		// Given
		givenCmpTags();
		givenCountsByCmp();

		// When
		ProductSearchResponseDTO response = service.searchProducts(request());

		// Then: 거르지 않으므로 건수 쿼리는 2번 (금리 탭, 다른 탭)
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(), any(),
				anyLong(), eq(0), any(), any(), any(), any(), any(Pageable.class));
		assertEquals(10L, response.getTotal());
		assertEquals(0, response.getHiddenCount());
	}

	@Test
	void 기준_상품이_없거나_게시가_아니면_거르지_않는다() {
		// Given: 번호 99는 없는 상품, 번호 98은 판매 종료 상품 (요청서 A4, C2)
		givenCmpTags();
		givenCountsByCmp();
		givenBaseProduct(98, ProductStatus.CLOSED, link(98, 1), link(98, 3));

		// When
		ProductSearchResponseDTO none = service.searchProducts(cmpRequest("99"));
		ProductSearchResponseDTO closed = service.searchProducts(cmpRequest("98"));

		// Then
		verify(loanProductRepository, times(4)).searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(), any(),
				anyLong(), eq(0), any(), any(), any(), any(), any(Pageable.class));
		assertEquals(0, none.getHiddenCount());
		assertEquals(0, closed.getHiddenCount());
	}

	@Test
	void 기준_상품의_용도와_방식_칩으로_거르고_숨긴_수를_센다() {
		// Given: 기준 상품 10은 생활비 + 원리금균등. 비교함에는 10, 11
		givenCmpTags();
		givenCountsByCmp();
		givenBaseProduct(10, ProductStatus.ON, link(10, 1), link(10, 3));

		// When
		ProductSearchResponseDTO response = service.searchProducts(cmpRequest("10,11"));

		// Then: 비교함 번호, 기준 용도 칩(생활비), 세 방식 칩, 기준 방식 칩(원리금균등)을 쿼리에 보냄
		ArgumentCaptor<Collection<Long>> cmpIds = ArgumentCaptor.forClass(Collection.class);
		ArgumentCaptor<Collection<Long>> purposeIds = ArgumentCaptor.forClass(Collection.class);
		ArgumentCaptor<Collection<Long>> allMethodIds = ArgumentCaptor.forClass(Collection.class);
		ArgumentCaptor<Collection<Long>> methodIds = ArgumentCaptor.forClass(Collection.class);
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(), any(),
				anyLong(), eq(1), cmpIds.capture(), purposeIds.capture(), allMethodIds.capture(), methodIds.capture(),
				any(Pageable.class));
		assertTrue(cmpIds.getAllValues().get(0).containsAll(List.of(10L, 11L)));
		assertEquals(List.of(1L), List.copyOf(purposeIds.getAllValues().get(0)));
		assertTrue(allMethodIds.getAllValues().get(0).containsAll(List.of(3L, 4L, 5L)));
		assertEquals(3, allMethodIds.getAllValues().get(0).size());
		assertEquals(List.of(3L), List.copyOf(methodIds.getAllValues().get(0)));
		// 건수는 거른 뒤 값 (4), 숨긴 수는 거르기 전 10 - 4
		assertEquals(4L, response.getTotal());
		assertEquals(6, response.getHiddenCount());
	}

	@Test
	void 기준_상품에_방식_칩이_없으면_세_방식_모두로_본다() {
		// Given: 기준 상품 10은 생활비만, 상환 방식은 기타(세 방식 아님)
		givenCmpTags();
		givenCountsByCmp();
		givenBaseProduct(10, ProductStatus.ON, link(10, 1), link(10, 6));

		// When
		service.searchProducts(cmpRequest("10"));

		// Then
		ArgumentCaptor<Collection<Long>> methodIds = ArgumentCaptor.forClass(Collection.class);
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(), any(),
				anyLong(), eq(1), any(), any(), any(), methodIds.capture(), any(Pageable.class));
		assertEquals(3, methodIds.getAllValues().get(0).size());
		assertTrue(methodIds.getAllValues().get(0).containsAll(List.of(3L, 4L, 5L)));
	}

	@Test
	void 기준_상품에_용도_칩이_없으면_겹치는_용도가_없다() {
		// Given: 기준 상품 10은 칩이 원리금균등뿐 (용도 없음)
		givenCmpTags();
		givenCountsByCmp();
		givenBaseProduct(10, ProductStatus.ON, link(10, 3));

		// When
		service.searchProducts(cmpRequest("10"));

		// Then: 용도 칩 자리에 -1 하나 (자기 자신만 보임)
		ArgumentCaptor<Collection<Long>> purposeIds = ArgumentCaptor.forClass(Collection.class);
		verify(loanProductRepository, times(2)).searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(), any(),
				anyLong(), eq(1), any(), purposeIds.capture(), any(), any(), any(Pageable.class));
		assertEquals(List.of(-1L), List.copyOf(purposeIds.getAllValues().get(0)));
	}

	@Test
	void 간편_검색은_용도와_방식이_겹치는_상품만_남기고_비교함_상품은_항상_보인다() {
		// Given: 기준 10 = 생활비 + 원리금균등. 모두 비대면 (키워드 충족)
		// A 생활비+원리금균등 (통과) / B 전월세 (용도 안 겹침) / C 생활비+만기일시 (방식 안 겹침)
		// D 생활비, 방식 칩 없음 (세 방식 모두라 통과) / E 전월세지만 비교함 상품 (항상 보임)
		givenKeywordData(online(1, "A"), online(2, "B"), online(3, "C"), online(4, "D"), online(5, "E"));
		givenCmpTags();
		givenBaseProduct(10, ProductStatus.ON, link(10, 1), link(10, 3));
		List<ProductTag> links = List.of(link(1, 1), link(1, 3), link(2, 2), link(3, 1), link(3, 5), link(4, 1), link(5, 2));
		when(productTagRepository.findAll()).thenReturn(links);

		// When
		KeywordSearchResponseDTO response = service
				.searchKeywords(new KeywordSearchRequestDTO(List.of("비대면"), "10,5"));

		// Then
		assertEquals(List.of("A", "D", "E"), response.getItems().stream().map(item -> item.getProduct().getProductName()).toList());
		assertEquals(2, response.getHiddenCount());
	}

	@Test
	void 간편_검색에_cmp가_없으면_숨긴_수는_0이다() {
		// Given
		givenKeywordData(online(1, "A"));

		// When
		KeywordSearchResponseDTO response = service.searchKeywords(keywords("비대면"));

		// Then
		assertEquals(1, response.getItems().size());
		assertEquals(0, response.getHiddenCount());
	}

	private LoanProduct online(long id, String name) {
		LoanProduct product = product(id, "은행" + id, name, "3.0");
		when(product.getOnlineYn()).thenReturn("Y");
		return product;
	}
}
