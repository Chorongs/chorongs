package chorong.product.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.product.entity.ProductStatus;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductRateRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.product.service.ProductService;
import chorong.product.service.ProductServiceImpl;
import jakarta.servlet.http.HttpSession;

/*
 * RANK-03 POST /api/products/{id}/views 주소 테스트
 * 기대값 출처: be_product.md RANK-03 (응답 204, 권한 모두 = 비회원 포함, 세션당 1회)
 * Service는 Mockito 가짜, 오류 응답은 GlobalExceptionHandler 그대로 사용
 */
class ProductControllerRecordViewTest {

	private ProductService productService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		productService = mock(ProductService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new ProductController(productService))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	@Test
	void 조회_기록은_204이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(post("/api/products/10/views"))
				.andExpect(status().isNoContent());
	}

	@Test
	void 로그인하지_않은_비회원도_조회_기록을_보낼_수_있다() throws Exception {
		// Given (세션 없이 보냄)

		// When
		mockMvc.perform(post("/api/products/10/views"))
				.andExpect(status().isNoContent());

		// Then
		verify(productService).recordView(eq(10L), any(HttpSession.class));
	}

	@Test
	void 주소의_상품_번호를_Service에_넘긴다() throws Exception {
		// Given, When
		mockMvc.perform(post("/api/products/37/views"));

		// Then
		verify(productService).recordView(eq(37L), any(HttpSession.class));
	}

	@Test
	void 숫자가_아닌_상품_번호면_400이고_Service를_부르지_않는다() throws Exception {
		// Given, When, Then
		mockMvc.perform(post("/api/products/abc/views"))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(productService);
	}

	@Test
	void Service가_404를_던지면_404로_응답한다() throws Exception {
		// Given
		doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(productService).recordView(eq(999L), any(HttpSession.class));

		// When, Then
		mockMvc.perform(post("/api/products/999/views"))
				.andExpect(status().isNotFound());
	}

	// ---- 실제 ProductServiceImpl을 붙여 같은 세션에서 두 번 보내는 경우까지 확인 ----

	private MockMvc realServiceMockMvc(LoanProductRepository loanProductRepository) {
		ProductServiceImpl realService = new ProductServiceImpl(loanProductRepository,
				mock(TagRepository.class), mock(ProductTagRepository.class), mock(ProductRateRepository.class));
		return MockMvcBuilders.standaloneSetup(new ProductController(realService))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	@Test
	void 같은_세션이_같은_상품에_두_번_보내면_둘_다_204이고_조회수는_한_번만_올린다() throws Exception {
		// Given
		LoanProductRepository loanProductRepository = mock(LoanProductRepository.class);
		when(loanProductRepository.findByProductIdAndProductStatus(10L, ProductStatus.CLOSED))
				.thenReturn(Optional.empty());
		when(loanProductRepository.increaseViewCount(10L)).thenReturn(1);
		MockMvc realMockMvc = realServiceMockMvc(loanProductRepository);
		MockHttpSession session = new MockHttpSession();

		// When, Then
		realMockMvc.perform(post("/api/products/10/views").session(session)).andExpect(status().isNoContent());
		realMockMvc.perform(post("/api/products/10/views").session(session)).andExpect(status().isNoContent());
		verify(loanProductRepository, times(1)).increaseViewCount(10L);
	}

	@Test
	void 없는_상품_번호는_404이고_두_번_보내도_두_번_다_404이다() throws Exception {
		// Given
		LoanProductRepository loanProductRepository = mock(LoanProductRepository.class);
		when(loanProductRepository.findByProductIdAndProductStatus(999L, ProductStatus.CLOSED))
				.thenReturn(Optional.empty());
		when(loanProductRepository.increaseViewCount(999L)).thenReturn(0);
		MockMvc realMockMvc = realServiceMockMvc(loanProductRepository);
		MockHttpSession session = new MockHttpSession();

		// When, Then
		realMockMvc.perform(post("/api/products/999/views").session(session)).andExpect(status().isNotFound());
		realMockMvc.perform(post("/api/products/999/views").session(session)).andExpect(status().isNotFound());
	}

	@Test
	void 판매_종료_상품은_404이고_조회수를_올리지_않는다() throws Exception {
		// Given
		LoanProductRepository loanProductRepository = mock(LoanProductRepository.class);
		when(loanProductRepository.findByProductIdAndProductStatus(10L, ProductStatus.CLOSED))
				.thenReturn(Optional.of(mock(chorong.product.entity.LoanProduct.class)));
		MockMvc realMockMvc = realServiceMockMvc(loanProductRepository);

		// When, Then
		realMockMvc.perform(post("/api/products/10/views")).andExpect(status().isNotFound());
		verify(loanProductRepository, never()).increaseViewCount(10L);
	}
}
