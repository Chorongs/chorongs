package chorong.search.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.util.MemoryCache;
import chorong.product.entity.LoanProduct;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.search.service.KeywordRule;
import chorong.search.service.SearchServiceImpl;

/*
 * 검색 주소 테스트 (SEARCH-01~03, B2, B19)
 * 실제 SearchServiceImpl에 Mockito 가짜 Repository를 붙여, 공격 요청(모르는 값, 범위 밖 값)이
 * 주소 단계에서 400으로 막히고 상품을 조회하지 않는지 확인
 */
class SearchControllerTest {

	private LoanProductRepository loanProductRepository;
	private ProductTagRepository productTagRepository;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		loanProductRepository = mock(LoanProductRepository.class);
		TagRepository tagRepository = mock(TagRepository.class);
		productTagRepository = mock(ProductTagRepository.class);
		SearchServiceImpl service = new SearchServiceImpl(loanProductRepository, tagRepository, productTagRepository,
				new MemoryCache(), new KeywordRule());
		mockMvc = MockMvcBuilders.standaloneSetup(new SearchController(service))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	// ---- 상세 검색 GET /api/products ----

	@Test
	void 정상_요청은_200이고_빈_결과도_오류가_아니다() throws Exception {
		// Given
		when(loanProductRepository.searchProducts(any(), anyInt(), anyInt(), any(), any(), anyInt(), any(), anyLong(),
				anyInt(), any(), any(), any(), any(), any(Pageable.class)))
				.thenReturn(new PageImpl<LoanProduct>(List.of(), PageRequest.of(0, 20), 0));

		// When, Then
		mockMvc.perform(get("/api/products").param("q", "청년"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.total").value(0))
				.andExpect(jsonPath("$.data.numCount").value(0))
				.andExpect(jsonPath("$.data.memoCount").value(0));
	}

	@Test
	void size가_50을_넘으면_400이고_상품을_조회하지_않는다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/products").param("size", "51"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_INPUT"));
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 모르는_rt_sort_값은_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/products").param("rt", "XXX")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/products").param("sort", "productName desc")).andExpect(status().isBadRequest());
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 숫자_아닌_page는_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/products").param("page", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_INPUT"));
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 비교함_cmp가_숫자가_아니거나_3개_이상이면_400이다() throws Exception {
		// Given, When, Then
		for (String bad : List.of("abc", "1,2,3", "1,,2", "")) {
			mockMvc.perform(get("/api/products").param("cmp", bad))
					.andExpect(status().isBadRequest())
					.andExpect(jsonPath("$.code").value("INVALID_INPUT"));
		}
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 검색어가_50자를_넘으면_400이다() throws Exception {
		// Given
		String longQuery = "가".repeat(51);

		// When, Then
		mockMvc.perform(get("/api/products").param("q", longQuery)).andExpect(status().isBadRequest());
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 모르는_칩_값은_400이고_상품을_조회하지_않는다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/products").param("region", "서울,아무데나"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_INPUT"));
		verifyNoInteractions(loanProductRepository);
	}

	// ---- 필터 칩 목록 GET /api/products/filters ----

	@Test
	void 필터_칩_목록은_200이고_필터_8개를_돌려준다() throws Exception {
		// Given: 칩이 하나도 없어도 필터 8개는 빈 칩 목록으로 옴
		when(productTagRepository.findTagPairsByProductStatus(any())).thenReturn(List.of());

		// When, Then
		mockMvc.perform(get("/api/products/filters"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.filters.length()").value(8))
				.andExpect(jsonPath("$.data.filters[0].key").value("target"))
				.andExpect(jsonPath("$.data.filters[7].key").value("credit"));
	}

	// ---- 간편 검색 POST /api/recommendations/keywords ----

	@Test
	void 키워드가_6개면_400이고_상품을_조회하지_않는다() throws Exception {
		// Given
		String body = "{\"keywords\":[\"사회초년생\",\"대학생\",\"프리랜서\",\"자영업자\",\"신용점수 낮음\",\"낮은 금리\"]}";

		// When, Then
		mockMvc.perform(post("/api/recommendations/keywords").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_INPUT"));
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 모르는_키워드는_400이다() throws Exception {
		// Given
		String body = "{\"keywords\":[\"사회초년생\",\"아무거나\"]}";

		// When, Then
		mockMvc.perform(post("/api/recommendations/keywords").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 키워드가_비어_있거나_본문이_없으면_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(post("/api/recommendations/keywords").contentType(MediaType.APPLICATION_JSON)
				.content("{\"keywords\":[]}")).andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/recommendations/keywords").contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(loanProductRepository);
	}

	@Test
	void 정상_키워드는_200이고_충족_0건은_빈_목록이다() throws Exception {
		// Given
		when(loanProductRepository.findByProductStatus(any())).thenReturn(List.of());
		when(productTagRepository.findAll()).thenReturn(List.of());
		String body = "{\"keywords\":[\"비대면\"]}";

		// When, Then
		mockMvc.perform(post("/api/recommendations/keywords").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data.items.length()").value(0))
				.andExpect(jsonPath("$.data.missedKeywords.length()").value(0));
		verify(loanProductRepository).findByProductStatus(any());
	}
}
