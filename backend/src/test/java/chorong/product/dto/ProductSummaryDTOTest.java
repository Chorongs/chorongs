package chorong.product.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.RateType;
import chorong.product.entity.Tag;
import chorong.product.entity.TagType;

/*
 * ProductSummaryDTO.from 테스트 (features 변환, 숨김 규칙)
 * DB 대신 Mockito 가짜 엔티티를 씀
 */
class ProductSummaryDTOTest {

	private LoanProduct product(ProductStatus status, String onlineYn, String noPrepayFeeYn, String policyYn,
			RateType rateType) {
		LoanProduct product = mock(LoanProduct.class);
		when(product.getProductId()).thenReturn(1L);
		when(product.getCompanyName()).thenReturn("테스트은행");
		when(product.getProductName()).thenReturn("테스트대출");
		when(product.getProductStatus()).thenReturn(status);
		when(product.getRateMin()).thenReturn(new BigDecimal("3.50"));
		when(product.getRateMax()).thenReturn(new BigDecimal("7.00"));
		when(product.getLimitAmount()).thenReturn(5000L);
		when(product.getTermMax()).thenReturn(60);
		when(product.getOnlineYn()).thenReturn(onlineYn);
		when(product.getNoPrepayFeeYn()).thenReturn(noPrepayFeeYn);
		when(product.getPolicyYn()).thenReturn(policyYn);
		when(product.getRateType()).thenReturn(rateType);
		return product;
	}

	@Test
	void 특징_코드는_정해진_순서로_나온다() {
		// Given
		LoanProduct product = product(ProductStatus.ON, "Y", "Y", "Y", RateType.BOTH);

		// When
		ProductSummaryDTO dto = ProductSummaryDTO.from(product, List.of());

		// Then
		assertEquals(List.of("ONLINE", "NO_PREPAY_FEE", "POLICY", "FIXED", "VARIABLE"), dto.getFeatures());
	}

	@Test
	void 금리_방식_변동만_있으면_VARIABLE만_나온다() {
		// Given
		LoanProduct product = product(ProductStatus.ON, "N", "N", "N", RateType.VARIABLE);

		// When
		ProductSummaryDTO dto = ProductSummaryDTO.from(product, List.of());

		// Then
		assertEquals(List.of("VARIABLE"), dto.getFeatures());
	}

	@Test
	void 특징_칸이_없으면_빈_목록() {
		// Given
		LoanProduct product = product(ProductStatus.ON, null, null, null, null);

		// When
		ProductSummaryDTO dto = ProductSummaryDTO.from(product, List.of());

		// Then
		assertTrue(dto.getFeatures().isEmpty());
	}

	@Test
	void 태그는_종류와_값으로_바뀐다() {
		// Given
		Tag tag = mock(Tag.class);
		when(tag.getTagType()).thenReturn(TagType.PURPOSE);
		when(tag.getTagValue()).thenReturn("생활비");
		LoanProduct product = product(ProductStatus.ON, "N", "N", "N", null);

		// When
		ProductSummaryDTO dto = ProductSummaryDTO.from(product, List.of(tag));

		// Then
		assertEquals(List.of(new ProductSummaryDTO.TagItem(TagType.PURPOSE, "생활비")), dto.getTags());
	}

	@Test
	void 숨김_상품은_번호_금융사_상품명_상태만_채운다() {
		// Given
		LoanProduct product = product(ProductStatus.HIDDEN, "Y", "Y", "Y", RateType.BOTH);

		// When
		ProductSummaryDTO dto = ProductSummaryDTO.from(product, List.of());

		// Then
		assertEquals(1L, dto.getProductId());
		assertEquals("테스트은행", dto.getCompanyName());
		assertEquals("테스트대출", dto.getProductName());
		assertEquals(ProductStatus.HIDDEN, dto.getProductStatus());
	}

	@Test
	void 숨김_상품은_나머지_칸이_비어_있다() {
		// Given
		LoanProduct product = product(ProductStatus.HIDDEN, "Y", "Y", "Y", RateType.BOTH);

		// When
		ProductSummaryDTO dto = ProductSummaryDTO.from(product, List.of());

		// Then
		assertNull(dto.getRateMin());
		assertNull(dto.getLimitAmount());
		assertTrue(dto.getTags().isEmpty());
		assertTrue(dto.getFeatures().isEmpty());
	}
}
