package chorong.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import chorong.admin.dto.AutoClosedHandleRequestDTO;
import chorong.admin.entity.ActionType;
import chorong.admin.entity.ChangeType;
import chorong.admin.entity.CheckResult;
import chorong.admin.entity.ProductSnapshot;
import chorong.admin.entity.ProductUpdateHistory;
import chorong.admin.repository.ProductSnapshotRepository;
import chorong.admin.repository.ProductUpdateHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.repository.LoanProductRepository;

/*
 * 자동 내림 (BAT-02), 확인, 다시 게시 (ADMIN-10)
 * 변경 기록 before_data는 FastAPI 되돌리기가 읽는 형식 그대로인지 확인
 */
class AdminAutoClosedServiceImplTest {

	private LoanProductRepository loanProductRepository;
	private ProductUpdateHistoryRepository historyRepository;
	private ProductSnapshotRepository snapshotRepository;
	private AdminAutoClosedServiceImpl service;

	@BeforeEach
	void setUp() {
		loanProductRepository = mock(LoanProductRepository.class);
		historyRepository = mock(ProductUpdateHistoryRepository.class);
		snapshotRepository = mock(ProductSnapshotRepository.class);
		service = new AdminAutoClosedServiceImpl(loanProductRepository, historyRepository, snapshotRepository,
				new MemoryCache());
		when(historyRepository.save(any(ProductUpdateHistory.class))).thenAnswer(invocation -> invocation.getArgument(0));
	}

	@Test
	void 이미_처리한_항목이_섞이면_409() {
		// Given: 1번만 확인 전, 2번은 이미 처리함
		when(snapshotRepository.findUncheckedByProductIds(eq(ActionType.AUTO_CLOSE), anyList()))
				.thenReturn(List.of(unchecked(1L)));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.handleAutoClosed(9L, new AutoClosedHandleRequestDTO(List.of(1L, 2L), CheckResult.KEEP)));

		// Then
		assertEquals(ErrorCode.CONFLICT, e.getErrorCode());
	}

	@Test
	void 확인하면_확인_결과_기록() {
		// Given
		ProductSnapshot snapshot = unchecked(1L);
		when(snapshotRepository.findUncheckedByProductIds(eq(ActionType.AUTO_CLOSE), anyList()))
				.thenReturn(List.of(snapshot));

		// When
		service.handleAutoClosed(9L, new AutoClosedHandleRequestDTO(List.of(1L), CheckResult.KEEP));

		// Then
		assertEquals(CheckResult.KEEP, snapshot.getCheckResult());
	}

	@Test
	void 내릴_상품이_0건이면_이력_없음() {
		// Given
		when(loanProductRepository.findByProductStatusAndDiscloseEndBefore(eq(ProductStatus.ON), any()))
				.thenReturn(List.of());

		// When
		service.closeExpiredProducts();

		// Then
		verify(historyRepository, never()).save(any());
	}

	@Test
	void 자동_내림_변경_기록은_바뀌기_전_상태만() {
		// Given
		LoanProduct product = mock(LoanProduct.class);
		when(product.getProductId()).thenReturn(1L);
		when(product.getProductStatus()).thenReturn(ProductStatus.ON);
		when(loanProductRepository.findByProductStatusAndDiscloseEndBefore(eq(ProductStatus.ON), any()))
				.thenReturn(List.of(product));

		// When
		service.closeExpiredProducts();

		// Then
		ArgumentCaptor<ProductSnapshot> saved = ArgumentCaptor.forClass(ProductSnapshot.class);
		verify(snapshotRepository).save(saved.capture());
		assertEquals("{\"product_status\":\"ON\"}", saved.getValue().getBeforeData());
	}

	@Test
	void 다시_게시_변경_기록에는_종료일도() {
		// Given
		LoanProduct product = mock(LoanProduct.class);
		when(product.getProductStatus()).thenReturn(ProductStatus.CLOSED);
		when(product.getDiscloseEnd()).thenReturn(LocalDateTime.of(2026, 10, 31, 0, 0));

		// When
		String json = AdminAutoClosedServiceImpl.reopenJson(product);

		// Then
		assertEquals("{\"product_status\":\"CLOSED\",\"disclose_end\":\"2026-10-31 00:00\"}", json);
	}

	@Test
	void 모르는_목록_필터는_400() {
		// Given, When
		BusinessException e = assertThrows(BusinessException.class, () -> service.getAutoClosed("ALL", 1));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	private ProductSnapshot unchecked(Long productId) {
		return ProductSnapshot.builder().snapshotId(productId).historyId(5L).productId(productId)
				.changeType(ChangeType.REMOVE).beforeData("{\"product_status\":\"ON\"}").build();
	}
}
