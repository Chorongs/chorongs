package chorong.admin.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.admin.dto.AutoClosedHandleRequestDTO;
import chorong.admin.dto.AutoClosedResponseDTO;
import chorong.admin.entity.ActionType;
import chorong.admin.entity.ChangeType;
import chorong.admin.entity.CheckResult;
import chorong.admin.entity.ProductSnapshot;
import chorong.admin.entity.ProductUpdateHistory;
import chorong.admin.repository.ProductSnapshotRepository;
import chorong.admin.repository.ProductUpdateHistoryRepository;
import chorong.common.dto.PageInfo;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.repository.LoanProductRepository;
import lombok.RequiredArgsConstructor;

/*
 * 상품 상태만 바꾸는 일은 Spring (EXT-05 비고): 자동 내림 REMOVE, 다시 게시 SHOW
 * 변경 기록 before_data는 FastAPI 되돌리기가 그대로 읽는 JSON (DB 칸 이름, 날짜 'yyyy-MM-dd HH:mm')
 */
@Service
@RequiredArgsConstructor
public class AdminAutoClosedServiceImpl implements AdminAutoClosedService {

	private static final int PAGE_SIZE = 20;		// 목록 한 쪽 (공통 기본 20)
	private static final String UNCHECKED = "UNCHECKED";
	private static final DateTimeFormatter JSON_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

	// 409 문구: 이미 처리함, 동시에 먼저 처리됨, 상품이 이미 판매 종료가 아님 (fe_admin API-48과 같은 글)
	static final String MSG_ALREADY_DONE = "다른 작업이 먼저 됨";

	private final LoanProductRepository loanProductRepository;
	private final ProductUpdateHistoryRepository productUpdateHistoryRepository;
	private final ProductSnapshotRepository productSnapshotRepository;
	private final MemoryCache memoryCache;

	@Override
	@Transactional(readOnly = true)
	public PageInfo<AutoClosedResponseDTO> getAutoClosed(String filter, int page) {
		if (page < 1) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		Pageable pageable = PageRequest.of(page - 1, PAGE_SIZE);
		Page<ProductSnapshot> snapshots = filter == null || UNCHECKED.equals(filter)
				? productSnapshotRepository.findUnchecked(ActionType.AUTO_CLOSE, pageable)
				: productSnapshotRepository.findChecked(ActionType.AUTO_CLOSE, toCheckResult(filter), pageable);

		// 상품, 이력은 한 번에 조회 (내린 날 = 자동 내림 이력 시각)
		List<ProductSnapshot> content = snapshots.getContent();
		Map<Long, LoanProduct> products = loanProductRepository
				.findAllById(content.stream().map(ProductSnapshot::getProductId).distinct().toList()).stream()
				.collect(Collectors.toMap(LoanProduct::getProductId, Function.identity()));
		Map<Long, ProductUpdateHistory> histories = productUpdateHistoryRepository
				.findAllById(content.stream().map(ProductSnapshot::getHistoryId).distinct().toList()).stream()
				.collect(Collectors.toMap(ProductUpdateHistory::getHistoryId, Function.identity()));

		List<AutoClosedResponseDTO> list = content.stream()
				.map(s -> {
					LoanProduct product = products.get(s.getProductId());
					ProductUpdateHistory history = histories.get(s.getHistoryId());
					return AutoClosedResponseDTO.builder()
							.productId(s.getProductId())
							.productName(product == null ? null : product.getProductName())
							.companyName(product == null ? null : product.getCompanyName())
							.discloseEnd(product == null ? null : product.getDiscloseEnd())
							.closedAt(history == null ? null : history.getUpdatedAt())
							.checkResult(s.getCheckResult())
							.build();
				})
				.toList();
		return new PageInfo<>(list, snapshots.getTotalElements(), page, PAGE_SIZE);
	}

	@Override
	@Transactional
	public void handleAutoClosed(Long adminId, AutoClosedHandleRequestDTO request) {
		LocalDateTime now = LocalDateTime.now();
		List<Long> productIds = request.getProductIds().stream().distinct().toList();

		// 고른 상품마다 확인 전 자동 내림 기록이 있어야 함 (없으면 이미 처리함 409, B9)
		List<ProductSnapshot> snapshots = productSnapshotRepository
				.findUncheckedByProductIds(ActionType.AUTO_CLOSE, productIds);
		Set<Long> unchecked = snapshots.stream().map(ProductSnapshot::getProductId).collect(Collectors.toSet());
		if (!unchecked.containsAll(productIds)) {
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_DONE);
		}

		// 확인 기록 먼저: 확인 전인 행만 바뀜 → 다른 관리자가 동시에 먼저 처리했으면 바뀐 줄 수가 모자라 409 (전부 되돌림)
		List<Long> snapshotIds = snapshots.stream().map(ProductSnapshot::getSnapshotId).toList();
		if (productSnapshotRepository.checkUnchecked(snapshotIds, request.getAction(), adminId, now) != snapshotIds.size()) {
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_DONE);
		}

		if (request.getAction() == CheckResult.REOPEN) {
			reopenProducts(adminId, productIds, now);
			memoryCache.clearProductCachesAfterCommit();	// 커밋 뒤에 (커밋 전에 비우면 옛 값이 다시 캐시될 수 있음)
		}
	}

	@Override
	@Transactional
	public int closeExpiredProducts() {
		// 1. 게시 상품 중 공시 종료일이 어제 이전 (= 오늘 0시 전)
		LocalDateTime now = LocalDateTime.now();
		List<LoanProduct> products = loanProductRepository
				.findByProductStatusAndDiscloseEndBefore(ProductStatus.ON, LocalDate.now().atStartOfDay());
		if (products.isEmpty()) {	// 0건이면 이력 없음
			return 0;
		}
		// 3. 반영 이력 1건 (처리자 null) + 상품별 변경 기록 / 2. 상태 CLOSED
		ProductUpdateHistory history = productUpdateHistoryRepository.save(
				newHistory(ActionType.AUTO_CLOSE, null, 0, products.size(), now));
		products.forEach(p -> {
			productSnapshotRepository.save(newSnapshot(history, p, ChangeType.REMOVE, statusJson(p.getProductStatus())));
			p.close();
		});
		// 4. 상품 캐시 비우기 (커밋 뒤에)
		memoryCache.clearProductCachesAfterCommit();
		return products.size();
	}

	// 다시 게시: 판매 종료 상태여야 함 (되돌리기, 불러오기로 이미 바뀌었으면 409) → 이력 SHOW + 변경 기록 + 종료일 비우고 게시
	private void reopenProducts(Long adminId, List<Long> productIds, LocalDateTime now) {
		List<LoanProduct> products = loanProductRepository.findAllById(productIds);
		boolean allClosed = products.size() == productIds.size()
				&& products.stream().allMatch(p -> p.getProductStatus() == ProductStatus.CLOSED);
		if (!allClosed) {
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_DONE);
		}
		ProductUpdateHistory history = productUpdateHistoryRepository.save(
				newHistory(ActionType.SHOW, adminId, products.size(), 0, now));
		products.forEach(p -> {
			productSnapshotRepository.save(newSnapshot(history, p, ChangeType.SHOW, reopenJson(p)));
			p.reopen();
		});
	}

	private static ProductUpdateHistory newHistory(ActionType actionType, Long adminId,
			int changedCount, int removedCount, LocalDateTime now) {
		return ProductUpdateHistory.builder()
				.adminId(adminId)
				.actionType(actionType)
				.addedCount(0)
				.changedCount(changedCount)
				.removedCount(removedCount)
				.updatedAt(now)
				.build();
	}

	private static ProductSnapshot newSnapshot(ProductUpdateHistory history, LoanProduct product,
			ChangeType changeType, String beforeData) {
		return ProductSnapshot.builder()
				.historyId(history.getHistoryId())
				.productId(product.getProductId())
				.changeType(changeType)
				.beforeData(beforeData)
				.build();
	}

	// 상태만 바꾼 기록: {"product_status":"ON"}
	static String statusJson(ProductStatus status) {
		return "{\"product_status\":\"" + status.name() + "\"}";
	}

	// 다시 게시 기록: {"product_status":"CLOSED","disclose_end":"2026-10-31 00:00"} (종료일이 없었으면 null)
	static String reopenJson(LoanProduct product) {
		String discloseEnd = product.getDiscloseEnd() == null
				? "null" : "\"" + product.getDiscloseEnd().format(JSON_DATE) + "\"";
		return "{\"product_status\":\"" + product.getProductStatus().name() + "\",\"disclose_end\":" + discloseEnd + "}";
	}

	// 목록 필터 (UNCHECKED 말고는 KEEP, REOPEN만, 모르는 값 400)
	private static CheckResult toCheckResult(String filter) {
		try {
			return CheckResult.valueOf(filter);
		} catch (IllegalArgumentException e) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
	}
}
