package chorong.product.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import chorong.product.dto.ProductDetailResponseDTO.BandRateItem;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.LoanType;
import chorong.product.entity.ProductRate;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.RateSource;
import chorong.product.entity.Source;

/*
 * ProductDetailResponseDTO.from 테스트 (bandRates, grouped, 숨김, 판매 종료)
 * DB 대신 Mockito 가짜 엔티티를 씀
 */
class ProductDetailResponseDTOTest {

	private static final String FSS_CODE = "0010001_PRD1_A";

	private LoanProduct product(Source source, LoanType loanType, String sourceCode, ProductStatus status) {
		LoanProduct product = mock(LoanProduct.class);
		when(product.getProductId()).thenReturn(1L);
		when(product.getCompanyName()).thenReturn("테스트은행");
		when(product.getProductName()).thenReturn("테스트대출");
		when(product.getSource()).thenReturn(source);
		when(product.getLoanType()).thenReturn(loanType);
		when(product.getSourceCode()).thenReturn(sourceCode);
		when(product.getProductStatus()).thenReturn(status);
		when(product.getRateMin()).thenReturn(new BigDecimal("3.50"));
		when(product.getPrepayFeeMax()).thenReturn(new BigDecimal("1.50"));
		return product;
	}

	private ProductRate rate(String key, String min, String max, RateSource source) {
		ProductRate rate = mock(ProductRate.class);
		when(rate.getRateKey()).thenReturn(key);
		when(rate.getRateMin()).thenReturn(new BigDecimal(min));
		when(rate.getRateMax()).thenReturn(new BigDecimal(max));
		when(rate.getRateSource()).thenReturn(source);
		return rate;
	}

	private List<ProductRate> allBandRates() {
		return List.of(
				rate("1", "3.00", "4.00", RateSource.DISCLOSED),
				rate("4", "4.00", "5.00", RateSource.DISCLOSED),
				rate("5", "5.00", "6.00", RateSource.DISCLOSED),
				rate("6", "6.00", "7.00", RateSource.DISCLOSED),
				rate("10", "8.00", "9.00", RateSource.DISCLOSED),
				rate("11", "7.50", "9.50", RateSource.DISCLOSED),
				rate("12", "8.50", "12.00", RateSource.DISCLOSED),
				rate("13", "9.00", "10.00", RateSource.DISCLOSED));
	}

	@Test
	void 금감원_개인신용은_BAND1부터_5까지_순서대로_5개() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertEquals(List.of("BAND1", "BAND2", "BAND3", "BAND4", "BAND5"),
				dto.getBandRates().stream().map(BandRateItem::getCreditBand).toList());
	}

	@Test
	void BAND2는_rate_key_4의_금리를_쓴다() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertEquals(new BigDecimal("4.00"), dto.getBandRates().get(1).getRateMin());
	}

	@Test
	void BAND5는_rate_key_10부터_13의_최저에서_최고() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		BandRateItem band5 = dto.getBandRates().get(4);
		assertEquals(new BigDecimal("7.50"), band5.getRateMin());
		assertEquals(new BigDecimal("12.00"), band5.getRateMax());
	}

	@Test
	void BAND5는_하나라도_추정이면_추정() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.ON);
		List<ProductRate> rates = List.of(
				rate("10", "8.00", "9.00", RateSource.DISCLOSED),
				rate("11", "7.50", "9.50", RateSource.ESTIMATED),
				rate("12", "8.50", "12.00", RateSource.DISCLOSED));

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), rates);

		// Then
		assertEquals(RateSource.ESTIMATED, dto.getBandRates().get(4).getRateSource());
	}

	@Test
	void BAND5는_모두_공시면_공시() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertEquals(RateSource.DISCLOSED, dto.getBandRates().get(4).getRateSource());
	}

	@Test
	void 금리_행이_없는_구간도_5개를_유지하고_값은_null() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.ON);
		List<ProductRate> rates = List.of(rate("1", "3.00", "4.00", RateSource.DISCLOSED));

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), rates);

		// Then
		assertEquals(5, dto.getBandRates().size());
		assertNull(dto.getBandRates().get(1).getRateMin());
		assertNull(dto.getBandRates().get(1).getRateSource());
	}

	@Test
	void 금감원_개인사업자도_구간_금리_5개() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.BIZ, FSS_CODE, ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertEquals(5, dto.getBandRates().size());
	}

	@Test
	void 금감원_전세는_구간_금리가_빈_목록() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.RENT, FSS_CODE, ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertTrue(dto.getBandRates().isEmpty());
	}

	@Test
	void 서민금융은_구간_금리가_빈_목록() {
		// Given
		LoanProduct product = product(Source.KINFA, LoanType.KINFA, "12345", ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertTrue(dto.getBandRates().isEmpty());
	}

	@Test
	void 신협_묶음은_grouped가_true이고_구간_금리가_빈_목록() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, "032000신협대출", ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertTrue(dto.getGrouped());
		assertTrue(dto.getBandRates().isEmpty());
	}

	@Test
	void 신협이_아니면_grouped가_false() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), List.of());

		// Then
		assertFalse(dto.getGrouped());
	}

	@Test
	void 판매_종료_상품은_상세_값과_상태를_준다() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.CLOSED);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertEquals(ProductStatus.CLOSED, dto.getProductStatus());
		assertEquals(new BigDecimal("1.50"), dto.getPrepayFeeMax());
	}

	@Test
	void 숨김_상품은_번호_금융사_상품명_상태만_채운다() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.HIDDEN);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertEquals(1L, dto.getProductId());
		assertEquals("테스트은행", dto.getCompanyName());
		assertEquals("테스트대출", dto.getProductName());
		assertEquals(ProductStatus.HIDDEN, dto.getProductStatus());
	}

	@Test
	void 숨김_상품은_나머지_칸이_비고_목록은_빈_목록_불리언은_false() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.HIDDEN);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), allBandRates());

		// Then
		assertNull(dto.getLoanType());
		assertNull(dto.getPrepayFeeMax());
		assertNull(dto.getApplyInfo());
		assertTrue(dto.getTags().isEmpty());
		assertTrue(dto.getFeatures().isEmpty());
		assertTrue(dto.getBandRates().isEmpty());
		assertFalse(dto.getGrouped());
		assertFalse(dto.getReported());
	}

	@Test
	void 신고_여부는_1차에서_늘_false() {
		// Given
		LoanProduct product = product(Source.FSS, LoanType.CREDIT, FSS_CODE, ProductStatus.ON);

		// When
		ProductDetailResponseDTO dto = ProductDetailResponseDTO.from(product, List.of(), List.of());

		// Then
		assertFalse(dto.getReported());
	}
}
