package chorong.product.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.product.dto.ProductDetailResponseDTO;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.RateKind;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductRateRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;

/*
 * ProductServiceImpl.getProduct 테스트 (PROD-01)
 * DB 대신 Mockito 가짜 Repository를 씀
 */
class ProductServiceImplTest {

	private static final Long PRODUCT_ID = 1L;

	private LoanProductRepository loanProductRepository;
	private TagRepository tagRepository;
	private ProductTagRepository productTagRepository;
	private ProductRateRepository productRateRepository;
	private ProductServiceImpl productService;

	@BeforeEach
	void setUp() {
		loanProductRepository = mock(LoanProductRepository.class);
		tagRepository = mock(TagRepository.class);
		productTagRepository = mock(ProductTagRepository.class);
		productRateRepository = mock(ProductRateRepository.class);
		productService = new ProductServiceImpl(loanProductRepository, tagRepository, productTagRepository,
				productRateRepository);
	}

	// 상품 가짜 객체를 만들어 findById가 돌려주게 등록 (when 안에서 다른 when을 부르면 Mockito 오류라 따로 둠)
	private void givenProduct(ProductStatus status) {
		LoanProduct product = mock(LoanProduct.class);
		when(product.getProductId()).thenReturn(PRODUCT_ID);
		when(product.getCompanyName()).thenReturn("테스트은행");
		when(product.getProductName()).thenReturn("테스트대출");
		when(product.getProductStatus()).thenReturn(status);
		when(loanProductRepository.findById(PRODUCT_ID)).thenReturn(Optional.of(product));
	}

	@Test
	void 없는_상품이면_404() {
		// Given
		when(loanProductRepository.findById(999L)).thenReturn(Optional.empty());

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> productService.getProduct(999L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 숨김_상품은_태그와_금리를_조회하지_않는다() {
		// Given
		givenProduct(ProductStatus.HIDDEN);

		// When
		productService.getProduct(PRODUCT_ID);

		// Then
		verifyNoInteractions(tagRepository, productTagRepository, productRateRepository);
	}

	@Test
	void 숨김_상품은_상태를_담아_응답한다() {
		// Given
		givenProduct(ProductStatus.HIDDEN);

		// When
		ProductDetailResponseDTO dto = productService.getProduct(PRODUCT_ID);

		// Then
		assertEquals(ProductStatus.HIDDEN, dto.getProductStatus());
	}

	@Test
	void 태그가_없으면_태그_테이블을_조회하지_않는다() {
		// Given
		givenProduct(ProductStatus.ON);
		when(productTagRepository.findByProductId(PRODUCT_ID)).thenReturn(List.of());

		// When
		productService.getProduct(PRODUCT_ID);

		// Then
		verify(tagRepository, never()).findByTagIdInOrderByTagId(any());
	}

	@Test
	void 상품에_붙은_태그를_응답에_담는다() {
		// Given
		ProductTag productTag = mock(ProductTag.class);
		when(productTag.getTagId()).thenReturn(7L);
		Tag tag = mock(Tag.class);
		when(tag.getTagType()).thenReturn(TagType.PURPOSE);
		when(tag.getTagValue()).thenReturn("생활비");
		givenProduct(ProductStatus.ON);
		when(productTagRepository.findByProductId(PRODUCT_ID)).thenReturn(List.of(productTag));
		when(tagRepository.findByTagIdInOrderByTagId(List.of(7L))).thenReturn(List.of(tag));

		// When
		ProductDetailResponseDTO dto = productService.getProduct(PRODUCT_ID);

		// Then
		assertEquals("생활비", dto.getTags().get(0).getTagValue());
	}

	@Test
	void 신용_구간_금리만_조회한다() {
		// Given
		givenProduct(ProductStatus.ON);
		when(productTagRepository.findByProductId(PRODUCT_ID)).thenReturn(List.of());

		// When
		productService.getProduct(PRODUCT_ID);

		// Then
		verify(productRateRepository).findByProductIdAndRateKind(PRODUCT_ID, RateKind.CREDIT);
	}
}
