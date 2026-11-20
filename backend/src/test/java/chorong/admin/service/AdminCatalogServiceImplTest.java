package chorong.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import chorong.admin.dto.HistoryResponseDTO;
import chorong.admin.dto.RollbackPreviewResponseDTO;
import chorong.admin.dto.RollbackRequestDTO;
import chorong.admin.entity.ActionType;
import chorong.admin.entity.ChangeType;
import chorong.admin.entity.ProductSnapshot;
import chorong.admin.entity.ProductUpdateHistory;
import chorong.admin.repository.AdminRepository;
import chorong.admin.repository.ProductSnapshotRepository;
import chorong.admin.repository.ProductUpdateHistoryRepository;
import chorong.common.client.FastApiClient;
import chorong.common.dto.FastApiVersionResponseDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.entity.ProductStatus;
import chorong.product.repository.LoanProductRepository;
import chorong.report.entity.ReportStatus;
import chorong.report.repository.LoanReportRepository;

/*
 * 반영 이력, 되돌리기 (ADMIN-05)
 */
class AdminCatalogServiceImplTest {

	private static final Long HIDDEN_PRODUCT = 50L;

	private ProductUpdateHistoryRepository historyRepository;
	private ProductSnapshotRepository snapshotRepository;
	private LoanReportRepository loanReportRepository;
	private FastApiClient fastApiClient;
	private MemoryCache memoryCache;
	private AdminCatalogServiceImpl service;

	@BeforeEach
	void setUp() {
		historyRepository = mock(ProductUpdateHistoryRepository.class);
		snapshotRepository = mock(ProductSnapshotRepository.class);
		loanReportRepository = mock(LoanReportRepository.class);
		fastApiClient = mock(FastApiClient.class);
		memoryCache = new MemoryCache();
		service = new AdminCatalogServiceImpl(mock(LoanProductRepository.class), historyRepository, snapshotRepository,
				loanReportRepository, mock(AdminRepository.class), fastApiClient, memoryCache);
	}

	@Test
	void 쪽_번호가_1보다_작으면_400() {
		// Given, When
		BusinessException e = assertThrows(BusinessException.class, () -> service.getHistories(null, 0));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 지금_마지막_이력은_되돌리기_불가() {
		// Given
		givenHistories(history(12L), 12L);

		// When
		HistoryResponseDTO row = service.getHistories(null, 1).getList().get(0);

		// Then
		assertFalse(row.getCanRollback());
	}

	@Test
	void 미리보기_마지막_이력이면_409() {
		// Given
		givenPreview(12L, 12L);

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> service.getRollbackPreview(12L));

		// Then
		assertEquals(AdminCatalogServiceImpl.MSG_NOTHING_TO_ROLLBACK, e.getMessage());
	}

	@Test
	void 미리보기_없는_이력이면_404() {
		// Given
		when(historyRepository.existsById(99L)).thenReturn(false);

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> service.getRollbackPreview(99L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 미리보기_기준_버전은_지금_마지막_이력_번호() {
		// Given
		givenPreview(10L, 12L);

		// When
		RollbackPreviewResponseDTO preview = service.getRollbackPreview(10L);

		// Then
		assertEquals(12L, preview.getBaseVersion());
	}

	@Test
	void 미리보기_숨김이_풀리는_상품의_미처리_신고_건수() {
		// Given: 이력 10 뒤에 숨긴 기록 (숨기기 전 ON) → 10으로 되돌리면 게시로 돌아감, 미처리 신고 3건
		givenPreview(10L, 12L);
		when(loanReportRepository.findProductIdsByProductStatus(ProductStatus.HIDDEN, ReportStatus.RECEIVED))
				.thenReturn(List.of(HIDDEN_PRODUCT));
		ProductSnapshot hide = ProductSnapshot.builder().historyId(11L).productId(HIDDEN_PRODUCT)
				.changeType(ChangeType.HIDE).beforeData("{\"product_status\":\"ON\"}").build();
		when(snapshotRepository.findByHistoryIdGreaterThanAndProductIdInOrderByHistoryIdAsc(eq(10L), anyList()))
				.thenReturn(List.of(hide));
		when(loanReportRepository.countByProductIdInAndReportStatus(anyCollection(), eq(ReportStatus.RECEIVED)))
				.thenReturn(3L);

		// When
		RollbackPreviewResponseDTO preview = service.getRollbackPreview(10L);

		// Then
		assertEquals(3, preview.getUnhiddenReportCount());
	}

	@Test
	void 되돌리기에_성공하면_상품_캐시_비움() {
		// Given
		memoryCache.put(MemoryCache.RECOMMEND, "ALL", "후보");
		when(fastApiClient.rollbackCatalog(any(), any(), any())).thenReturn(new FastApiVersionResponseDTO(13L));

		// When
		service.rollback(1L, new RollbackRequestDTO(10L, 12L));

		// Then
		assertNull(memoryCache.get(MemoryCache.RECOMMEND, "ALL"));
	}

	private ProductUpdateHistory history(Long historyId) {
		return ProductUpdateHistory.builder().historyId(historyId).actionType(ActionType.PUBLISH)
				.addedCount(0).changedCount(0).removedCount(0).build();
	}

	private void givenPreview(Long historyId, Long currentVersion) {
		when(historyRepository.existsById(historyId)).thenReturn(true);
		when(historyRepository.findTopByOrderByHistoryIdDesc()).thenReturn(Optional.of(history(currentVersion)));
	}

	private void givenHistories(ProductUpdateHistory row, Long currentVersion) {
		when(historyRepository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(List.of(row)));
		when(historyRepository.findTopByOrderByHistoryIdDesc()).thenReturn(Optional.of(history(currentVersion)));
	}
}
