package chorong.recommend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import chorong.recommend.dto.RecommendSaveRequestDTO;
import chorong.recommend.dto.SavedRecommendResponseDTO;
import chorong.recommend.entity.RecommendResult;
import chorong.recommend.repository.RecommendResultRepository;

/*
 * RecommendResultServiceImpl 테스트 (LOAN-04)
 * 기획서 7-1 시나리오 13, 14, 17 + 남의 저장 삭제 차단 (B3)
 */
class RecommendResultServiceImplTest {

	private static final Long MEMBER_ID = 1L;
	private static final Long OTHER_MEMBER_ID = 2L;

	private RecommendResultRepository recommendResultRepository;
	private LoanProductRepository loanProductRepository;
	private ProductTagRepository productTagRepository;
	private RecommendResultServiceImpl recommendResultService;

	@BeforeEach
	void setUp() {
		recommendResultRepository = mock(RecommendResultRepository.class);
		loanProductRepository = mock(LoanProductRepository.class);
		productTagRepository = mock(ProductTagRepository.class);
		TagRepository tagRepository = mock(TagRepository.class);
		recommendResultService = new RecommendResultServiceImpl(recommendResultRepository, loanProductRepository,
				productTagRepository, tagRepository);
	}

	// ---- 테스트 데이터 ----

	private static LoanProduct product(long id, ProductStatus status) {
		LoanProduct product = BeanUtils.instantiateClass(LoanProduct.class);
		ReflectionTestUtils.setField(product, "productId", id);
		ReflectionTestUtils.setField(product, "companyName", "기관" + id);
		ReflectionTestUtils.setField(product, "productName", "상품" + id);
		ReflectionTestUtils.setField(product, "productStatus", status);
		return product;
	}

	// 상품 번호 목록이 모두 있는 상품이 되게 등록
	private void givenProducts(List<Long> productIds) {
		List<LoanProduct> products = new ArrayList<>();
		for (Long id : productIds) {
			products.add(product(id, ProductStatus.ON));
		}
		when(loanProductRepository.findAllById(productIds)).thenReturn(products);
	}

	private static RecommendResult row(long saveId, long productId, int rankNo) {
		return RecommendResult.builder()
				.saveId(saveId)
				.memberId(MEMBER_ID)
				.productId(productId)
				.rankNo(rankNo)
				.conditionLabel("생활비 1,000만원 / 3년 / 직장인")
				.createdAt(LocalDateTime.of(2026, 11, 13, 10, 0))
				.build();
	}

	private static RecommendSaveRequestDTO request(List<Long> productIds) {
		return new RecommendSaveRequestDTO("생활비", 1000, 36, "OFFICE", productIds);
	}

	// ---- 저장 ----

	@Test
	void 시나리오13_저장하면_같은_saveId로_순위대로_행을_만듦() {
		// Given: saveAll에 넘어온 행을 '묶음:순위:상품' 글로 모아 둠
		List<Long> productIds = List.of(11L, 12L, 13L);
		givenProducts(productIds);
		when(recommendResultRepository.nextSaveId()).thenReturn(7L);
		List<String> saved = new ArrayList<>();
		when(recommendResultRepository.saveAll(anyList())).thenAnswer(invocation -> {
			List<?> rows = invocation.getArgument(0);
			for (Object row : rows) {
				RecommendResult result = (RecommendResult) row;
				saved.add(result.getSaveId() + ":" + result.getRankNo() + ":" + result.getProductId());
			}
			return rows;
		});

		// When
		recommendResultService.saveRecommendResult(MEMBER_ID, request(productIds));

		// Then
		assertEquals(List.of("7:1:11", "7:2:12", "7:3:13"), saved);
	}

	@Test
	void 시나리오13_조건_라벨은_용도_금액_기간_직업() {
		// Given
		RecommendSaveRequestDTO request = request(List.of(1L));

		// When
		String label = RecommendResultServiceImpl.conditionLabel(request);

		// Then
		assertEquals("생활비 1,000만원 / 3년 / 직장인", label);
	}

	@Test
	void 라벨은_1억_넘으면_억으로_기간_모름은_그대로() {
		// Given
		RecommendSaveRequestDTO request = new RecommendSaveRequestDTO("주택 구입", 15000, 0, "BIZ", List.of(1L));

		// When
		String label = RecommendResultServiceImpl.conditionLabel(request);

		// Then
		assertEquals("주택 구입 1억 5,000만원 / 기간 모름 / 사업자", label);
	}

	@Test
	void 시나리오14_11번째_저장이면_가장_오래된_묶음을_삭제() {
		// Given: 저장 묶음 11개 (11이 최신, 1이 가장 오래됨)
		List<Long> productIds = List.of(11L);
		givenProducts(productIds);
		when(recommendResultRepository.nextSaveId()).thenReturn(11L);
		List<RecommendResult> rows = new ArrayList<>();
		for (long saveId = 11; saveId >= 1; saveId--) {
			rows.add(row(saveId, 11L, 1));
		}
		when(recommendResultRepository.findByMemberIdOrderBySaveIdDescRankNoAsc(MEMBER_ID)).thenReturn(rows);

		// When
		recommendResultService.saveRecommendResult(MEMBER_ID, request(productIds));

		// Then
		verify(recommendResultRepository).deleteBySaveIdAndMemberId(1L, MEMBER_ID);
	}

	@Test
	void 상품_번호가_중복이면_400() {
		// Given
		RecommendSaveRequestDTO request = request(List.of(11L, 11L));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> recommendResultService.saveRecommendResult(MEMBER_ID, request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 없는_상품이_있으면_400() {
		// Given: 2개 중 1개만 있음
		List<Long> productIds = List.of(11L, 999L);
		when(loanProductRepository.findAllById(productIds)).thenReturn(List.of(product(11L, ProductStatus.ON)));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> recommendResultService.saveRecommendResult(MEMBER_ID, request(productIds)));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 잘못된_값이면_저장하지_않음() {
		// Given
		RecommendSaveRequestDTO request = request(List.of(11L, 11L));

		// When
		assertThrows(BusinessException.class, () -> recommendResultService.saveRecommendResult(MEMBER_ID, request));

		// Then
		verify(recommendResultRepository, never()).saveAll(anyList());
	}

	@Test
	void 생활비에_180개월로_저장하면_400() {
		// Given
		RecommendSaveRequestDTO request = new RecommendSaveRequestDTO("생활비", 1000, 180, "OFFICE", List.of(11L));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> recommendResultService.saveRecommendResult(MEMBER_ID, request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	// ---- 목록 ----

	@Test
	void 시나리오17_판매_종료_상품도_목록에_상태와_함께() {
		// Given
		when(recommendResultRepository.findByMemberIdOrderBySaveIdDescRankNoAsc(MEMBER_ID))
				.thenReturn(List.of(row(5L, 11L, 1)));
		when(loanProductRepository.findAllById(List.of(11L))).thenReturn(List.of(product(11L, ProductStatus.CLOSED)));
		when(productTagRepository.findByProductIdIn(List.of(11L))).thenReturn(List.of());

		// When
		SavedRecommendResponseDTO response = recommendResultService.getRecommendResults(MEMBER_ID);

		// Then
		assertEquals(ProductStatus.CLOSED, response.getSaves().get(0).getProducts().get(0).getProduct().getProductStatus());
	}

	@Test
	void 저장이_없으면_빈_목록() {
		// Given
		when(recommendResultRepository.findByMemberIdOrderBySaveIdDescRankNoAsc(MEMBER_ID)).thenReturn(List.of());

		// When
		SavedRecommendResponseDTO response = recommendResultService.getRecommendResults(MEMBER_ID);

		// Then
		assertTrue(response.getSaves().isEmpty());
	}

	// ---- 삭제 (B3) ----

	@Test
	void 남의_저장을_삭제하면_404() {
		// Given: 5번 저장은 다른 회원 것
		when(recommendResultRepository.existsBySaveIdAndMemberId(5L, OTHER_MEMBER_ID)).thenReturn(false);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> recommendResultService.deleteRecommendResult(OTHER_MEMBER_ID, 5L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 남의_저장은_지우지_않음() {
		// Given
		when(recommendResultRepository.existsBySaveIdAndMemberId(5L, OTHER_MEMBER_ID)).thenReturn(false);

		// When
		assertThrows(BusinessException.class, () -> recommendResultService.deleteRecommendResult(OTHER_MEMBER_ID, 5L));

		// Then
		verify(recommendResultRepository, never()).deleteBySaveIdAndMemberId(5L, OTHER_MEMBER_ID);
	}

	@Test
	void 내_저장은_삭제() {
		// Given
		when(recommendResultRepository.existsBySaveIdAndMemberId(5L, MEMBER_ID)).thenReturn(true);

		// When
		recommendResultService.deleteRecommendResult(MEMBER_ID, 5L);

		// Then
		verify(recommendResultRepository).deleteBySaveIdAndMemberId(5L, MEMBER_ID);
	}
}
