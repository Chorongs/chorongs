package chorong.product.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.exception.GlobalExceptionHandler;
import chorong.product.dto.ProductDetailResponseDTO;
import chorong.product.service.ProductService;

/*
 * COM-01 GET /api/products?ids= 주소 테스트 (B2)
 * Service는 Mockito 가짜, 오류 응답은 GlobalExceptionHandler 그대로 사용
 */
class ProductControllerTest {

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
	void 숫자_아닌_id는_400() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/products").param("ids", "1,abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_INPUT"));
	}

	@Test
	void 숫자_아닌_id면_Service를_부르지_않는다() throws Exception {
		// Given, When
		mockMvc.perform(get("/api/products").param("ids", "abc"));

		// Then
		verifyNoInteractions(productService);
	}

	@Test
	void ids를_쉼표로_보내면_번호_목록으로_Service에_전달한다() throws Exception {
		// Given
		ProductDetailResponseDTO first = new ProductDetailResponseDTO();
		first.setProductId(1L);
		ProductDetailResponseDTO second = new ProductDetailResponseDTO();
		second.setProductId(2L);
		when(productService.getCompareProducts(List.of(1L, 2L))).thenReturn(List.of(first, second));

		// When, Then
		mockMvc.perform(get("/api/products").param("ids", "1,2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data[0].productId").value(1))
				.andExpect(jsonPath("$.data[1].productId").value(2));
	}
}
