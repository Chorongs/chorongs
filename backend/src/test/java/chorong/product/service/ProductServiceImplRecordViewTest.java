package chorong.product.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.SessionConst;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductRateRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;

/*
 * ProductServiceImpl.recordView 테스트 (RANK-03 상품 조회 기록)
 * 기대값 출처: be_product.md RANK-03
 *   세션의 본 상품 목록(SessionConst.VIEWED_PRODUCTS, 상품 번호 Set)에 있으면 무시, 없으면 목록에 넣고 view_count + 1
 * 명세서에 없는 선택(사용자 결정):
 *   판매 종료(CLOSED) 상품은 세지 않고 404 / 없는 상품 번호는 404이고 세션 목록에서도 뺌 / 게시(ON), 숨김(HIDDEN)은 +1
 * DB 대신 Mockito 가짜 Repository를 씀
 */
class ProductServiceImplRecordViewTest {

	private static final Long PRODUCT_ID = 10L;
	private static final Long OTHER_PRODUCT_ID = 20L;
	private static final Long MISSING_PRODUCT_ID = 999L;

	private LoanProductRepository loanProductRepository;
	private ProductServiceImpl productService;
	private MockHttpSession session;

	@BeforeEach
	void setUp() {
		loanProductRepository = mock(LoanProductRepository.class);
		productService = new ProductServiceImpl(loanProductRepository, mock(TagRepository.class),
				mock(ProductTagRepository.class), mock(ProductRateRepository.class));
		session = new MockHttpSession();
	}

	// 이 번호의 상품이 있어서 UPDATE가 1행을 바꾸는 상태 (판매 종료가 아님)
	private void givenExistingProduct(Long productId) {
		when(loanProductRepository.findByProductIdAndProductStatus(productId, ProductStatus.CLOSED))
				.thenReturn(Optional.empty());
		when(loanProductRepository.increaseViewCount(productId)).thenReturn(1);
	}

	// 이 번호가 판매 종료(CLOSED) 상품인 상태
	private void givenClosedProduct(Long productId) {
		LoanProduct closed = mock(LoanProduct.class);
		when(loanProductRepository.findByProductIdAndProductStatus(productId, ProductStatus.CLOSED))
				.thenReturn(Optional.of(closed));
	}

	// 이 번호의 상품이 없어서 UPDATE가 0행인 상태
	private void givenMissingProduct(Long productId) {
		when(loanProductRepository.findByProductIdAndProductStatus(productId, ProductStatus.CLOSED))
				.thenReturn(Optional.empty());
		when(loanProductRepository.increaseViewCount(productId)).thenReturn(0);
	}

	@SuppressWarnings("unchecked")
	private Set<Long> viewedInSession() {
		return (Set<Long>) session.getAttribute(SessionConst.VIEWED_PRODUCTS);
	}

	// ---------- 처음 보는 상품 ----------

	@Test
	void 처음_보는_상품이면_조회수를_올린다() {
		// Given
		givenExistingProduct(PRODUCT_ID);

		// When
		productService.recordView(PRODUCT_ID, session);

		// Then
		verify(loanProductRepository).increaseViewCount(PRODUCT_ID);
	}

	@Test
	void 처음_보는_상품이면_세션의_본_상품_목록에_넣는다() {
		// Given
		givenExistingProduct(PRODUCT_ID);

		// When
		productService.recordView(PRODUCT_ID, session);

		// Then
		assertTrue(viewedInSession().contains(PRODUCT_ID));
	}

	@Test
	void 세션에_목록이_없어도_오류_없이_새로_만들어_넣는다() {
		// Given
		givenExistingProduct(PRODUCT_ID);
		assertEquals(null, session.getAttribute(SessionConst.VIEWED_PRODUCTS));

		// When
		productService.recordView(PRODUCT_ID, session);

		// Then
		assertEquals(Set.of(PRODUCT_ID), viewedInSession());
	}

	@Test
	void 세션에_Set이_아닌_값이_있어도_새_목록으로_바꿔_센다() {
		// Given
		givenExistingProduct(PRODUCT_ID);
		session.setAttribute(SessionConst.VIEWED_PRODUCTS, "잘못된 값");

		// When
		productService.recordView(PRODUCT_ID, session);

		// Then
		verify(loanProductRepository).increaseViewCount(PRODUCT_ID);
		assertEquals(Set.of(PRODUCT_ID), viewedInSession());
	}

	@Test
	void 세션_목록에_Long이_아닌_값이_섞여_있으면_그_값만_버리고_나머지는_유지한다() {
		// Given
		givenExistingProduct(PRODUCT_ID);
		Set<Object> saved = new HashSet<>();
		saved.add(OTHER_PRODUCT_ID);
		saved.add("글자");
		session.setAttribute(SessionConst.VIEWED_PRODUCTS, saved);

		// When
		productService.recordView(PRODUCT_ID, session);

		// Then
		assertEquals(Set.of(PRODUCT_ID, OTHER_PRODUCT_ID), viewedInSession());
	}

	// ---------- 같은 세션에서 다시 봄 (세션당 1회) ----------

	@Test
	void 같은_세션에서_같은_상품을_다시_보면_조회수를_올리지_않는다() {
		// Given
		givenExistingProduct(PRODUCT_ID);
		productService.recordView(PRODUCT_ID, session);

		// When
		productService.recordView(PRODUCT_ID, session);

		// Then
		verify(loanProductRepository, times(1)).increaseViewCount(PRODUCT_ID);
	}

	@Test
	void 세션에_이미_있는_상품이면_판매_종료_확인과_조회수_수정을_하지_않는다() {
		// Given
		session.setAttribute(SessionConst.VIEWED_PRODUCTS, new HashSet<>(Set.of(PRODUCT_ID)));

		// When
		productService.recordView(PRODUCT_ID, session);

		// Then
		verify(loanProductRepository, never()).increaseViewCount(PRODUCT_ID);
	}

	@Test
	void 다른_상품은_각각_센다() {
		// Given
		givenExistingProduct(PRODUCT_ID);
		givenExistingProduct(OTHER_PRODUCT_ID);

		// When
		productService.recordView(PRODUCT_ID, session);
		productService.recordView(OTHER_PRODUCT_ID, session);

		// Then
		verify(loanProductRepository).increaseViewCount(PRODUCT_ID);
		verify(loanProductRepository).increaseViewCount(OTHER_PRODUCT_ID);
		assertEquals(Set.of(PRODUCT_ID, OTHER_PRODUCT_ID), viewedInSession());
	}

	@Test
	void 세션이_다르면_같은_상품도_각각_센다() {
		// Given
		givenExistingProduct(PRODUCT_ID);
		MockHttpSession otherSession = new MockHttpSession();

		// When
		productService.recordView(PRODUCT_ID, session);
		productService.recordView(PRODUCT_ID, otherSession);

		// Then
		verify(loanProductRepository, times(2)).increaseViewCount(PRODUCT_ID);
	}

	// ---------- 판매 종료 상품 ----------

	@Test
	void 판매_종료_상품이면_404이다() {
		// Given
		givenClosedProduct(PRODUCT_ID);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> productService.recordView(PRODUCT_ID, session));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 판매_종료_상품은_조회수를_올리지_않고_세션_목록에도_넣지_않는다() {
		// Given
		givenClosedProduct(PRODUCT_ID);

		// When
		assertThrows(BusinessException.class, () -> productService.recordView(PRODUCT_ID, session));

		// Then
		verify(loanProductRepository, never()).increaseViewCount(PRODUCT_ID);
		assertEquals(null, session.getAttribute(SessionConst.VIEWED_PRODUCTS));
	}

	@Test
	void 판매_종료가_아닌_상품은_숨김_상품이어도_센다() {
		// Given
		givenExistingProduct(PRODUCT_ID);

		// When
		productService.recordView(PRODUCT_ID, session);

		// Then
		verify(loanProductRepository).findByProductIdAndProductStatus(PRODUCT_ID, ProductStatus.CLOSED);
		verify(loanProductRepository).increaseViewCount(PRODUCT_ID);
	}

	// ---------- 없는 상품 번호 ----------

	@Test
	void 없는_상품_번호면_404이다() {
		// Given
		givenMissingProduct(MISSING_PRODUCT_ID);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> productService.recordView(MISSING_PRODUCT_ID, session));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 없는_상품_번호면_세션_목록에서_그_번호를_뺀다() {
		// Given
		givenMissingProduct(MISSING_PRODUCT_ID);

		// When
		assertThrows(BusinessException.class, () -> productService.recordView(MISSING_PRODUCT_ID, session));

		// Then
		assertFalse(viewedInSession().contains(MISSING_PRODUCT_ID));
	}

	@Test
	void 없는_상품_번호를_두_번_보내도_두_번_다_404이다() {
		// Given
		givenMissingProduct(MISSING_PRODUCT_ID);
		assertThrows(BusinessException.class, () -> productService.recordView(MISSING_PRODUCT_ID, session));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> productService.recordView(MISSING_PRODUCT_ID, session));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
		verify(loanProductRepository, times(2)).increaseViewCount(MISSING_PRODUCT_ID);
	}

	@Test
	void 없는_상품_번호로_404가_나도_앞서_센_상품은_세션_목록에_남는다() {
		// Given
		givenExistingProduct(PRODUCT_ID);
		givenMissingProduct(MISSING_PRODUCT_ID);
		productService.recordView(PRODUCT_ID, session);

		// When
		assertThrows(BusinessException.class, () -> productService.recordView(MISSING_PRODUCT_ID, session));
		productService.recordView(PRODUCT_ID, session);

		// Then
		assertTrue(viewedInSession().contains(PRODUCT_ID));
		verify(loanProductRepository, times(1)).increaseViewCount(PRODUCT_ID);
	}
}
