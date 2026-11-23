package chorong.admin.service;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.admin.dto.CatalogResponseDTO;
import chorong.admin.dto.HistoryResponseDTO;
import chorong.admin.dto.PublishResponseDTO;
import chorong.admin.dto.RollbackPreviewResponseDTO;
import chorong.admin.dto.RollbackRequestDTO;
import chorong.admin.entity.ActionType;
import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import chorong.admin.entity.ChangeType;
import chorong.admin.entity.ProductSnapshot;
import chorong.admin.entity.ProductUpdateHistory;
import chorong.admin.repository.AdminRepository;
import chorong.admin.repository.ProductSnapshotRepository;
import chorong.admin.repository.ProductUpdateHistoryRepository;
import chorong.common.client.FastApiClient;
import chorong.common.dto.FastApiVersionResponseDTO;
import chorong.common.dto.PageInfo;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.Source;
import chorong.product.repository.LoanProductRepository;
import chorong.report.entity.ReportStatus;
import chorong.report.repository.LoanReportRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AdminCatalogServiceImpl implements AdminCatalogService {

	private static final int HISTORY_SIZE = 12;			// 이력 한 쪽 (최신 12건 + 더 보기)
	private static final long REPORTED_MIN = 5;			// 메뉴 옆 신고 상품 = 미처리 5건 이상

	// 변경 기록 JSON에서 바뀌기 전 상태 꺼내기 ({"product_status":"ON", ...})
	private static final Pattern PRODUCT_STATUS = Pattern.compile("\"product_status\"\\s*:\\s*\"([A-Z]+)\"");

	private final LoanProductRepository loanProductRepository;
	private final ProductUpdateHistoryRepository productUpdateHistoryRepository;
	private final ProductSnapshotRepository productSnapshotRepository;
	private final LoanReportRepository loanReportRepository;
	private final AdminRepository adminRepository;
	private final FastApiClient fastApiClient;
	private final MemoryCache memoryCache;

	@Override
	@Transactional(readOnly = true)
	public CatalogResponseDTO getCatalog(Long adminId) {
		List<CatalogResponseDTO.SourceCountItem> sourceCounts = List.of(Source.values()).stream()
				.map(source -> new CatalogResponseDTO.SourceCountItem(source,
						Math.toIntExact(loanProductRepository.countBySourceAndProductStatus(source, ProductStatus.ON))))
				.toList();
		ProductUpdateHistory latest = productUpdateHistoryRepository.findTopByOrderByHistoryIdDesc().orElse(null);
		long autoClosedUnchecked = productSnapshotRepository
				.findUnchecked(ActionType.AUTO_CLOSE, PageRequest.of(0, 1)).getTotalElements();
		int reportedProducts = loanReportRepository
				.findProductIdsWithReports(ReportStatus.RECEIVED, REPORTED_MIN).size();

		// 승인 대기 개수는 승인권자만 (역할은 세션이 아니라 DB 기준)
		boolean approver = adminRepository.findById(adminId)
				.map(a -> a.getAdminRole() == AdminRole.APPROVER).orElse(false);
		Integer pendingAdmins = approver
				? Math.toIntExact(adminRepository.countByAdminStatus(AdminStatus.PENDING)) : null;

		return CatalogResponseDTO.builder()
				.sourceCounts(sourceCounts)
				.currentVersion(latest == null ? null : latest.getHistoryId())
				.lastUpdatedAt(latest == null ? null : latest.getUpdatedAt())
				.autoClosedUncheckedCount(Math.toIntExact(autoClosedUnchecked))
				.reportedProductCount(reportedProducts)
				.pendingAdminCount(pendingAdmins)
				.build();
	}

	@Override
	@Transactional(readOnly = true)
	public PageInfo<HistoryResponseDTO> getHistories(ActionType actionType, int page) {
		if (page < 1) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		Pageable pageable = PageRequest.of(page - 1, HISTORY_SIZE, Sort.by(Sort.Direction.DESC, "historyId"));
		Page<ProductUpdateHistory> histories = actionType == null
				? productUpdateHistoryRepository.findAll(pageable)
				: productUpdateHistoryRepository.findByActionType(actionType, pageable);
		Long currentVersion = productUpdateHistoryRepository.findTopByOrderByHistoryIdDesc()
				.map(ProductUpdateHistory::getHistoryId).orElse(null);

		// 처리자 이름 (한 번에 조회) / 되돌리면 바뀌는 수는 미리보기에서 셈
		Map<Long, String> adminNames = getAdminNames(histories.getContent());
		List<HistoryResponseDTO> list = histories.getContent().stream()
				.map(history -> {
					HistoryResponseDTO response = HistoryResponseDTO.from(history, adminNames.get(history.getAdminId()));
					response.setCanRollback(canRollback(history.getHistoryId(), currentVersion));
					return response;
				})
				.toList();
		return new PageInfo<>(list, histories.getTotalElements(), page, HISTORY_SIZE);
	}

	@Override
	@Transactional(readOnly = true)
	public RollbackPreviewResponseDTO getRollbackPreview(Long historyId) {
		if (!productUpdateHistoryRepository.existsById(historyId)) {
			throw new BusinessException(ErrorCode.NOT_FOUND);
		}
		Long currentVersion = productUpdateHistoryRepository.findTopByOrderByHistoryIdDesc()
				.map(ProductUpdateHistory::getHistoryId).orElse(null);
		if (!canRollback(historyId, currentVersion)) {	// 지금 마지막 이력: 되돌릴 변경이 없음 (FastAPI와 같은 409)
			throw new BusinessException(ErrorCode.CONFLICT, FastApiClient.MSG_NOTHING_TO_ROLLBACK);
		}
		return RollbackPreviewResponseDTO.builder()
				.historyId(historyId)
				.baseVersion(currentVersion)
				.cancelCount(Math.toIntExact(productUpdateHistoryRepository.countByHistoryIdGreaterThan(historyId)))
				.changedProductCount(Math.toIntExact(productSnapshotRepository.countChangedProductsAfter(historyId)))
				.unhiddenReportCount(countUnhiddenReports(historyId))
				.build();
	}

	@Override
	public PublishResponseDTO rollback(Long adminId, RollbackRequestDTO request) {
		FastApiVersionResponseDTO result = fastApiClient.rollbackCatalog(
				request.getHistoryId(), request.getBaseVersion(), adminId);
		memoryCache.clearProductCaches();	// 성공 응답을 받은 뒤에만 (실패는 예외라 안 비움)
		return new PublishResponseDTO(result.getVersion());
	}

	// 되돌리기 가능: 지금 마지막 이력보다 앞선 이력만 (마지막 이력은 되돌릴 변경이 없음, FastAPI 409 NOTHING_TO_ROLLBACK)
	private static boolean canRollback(Long historyId, Long currentVersion) {
		return currentVersion != null && historyId < currentVersion;
	}

	// 이 시점으로 되돌리면 숨김이 풀려 게시(ON)되는 상품의 미처리 신고 건수
	// 대상 = 지금 숨김 + 미처리 신고가 있는 상품 / 되돌리면 각 상품은 이 이력 뒤 '가장 오래된' 변경 기록의 바뀌기 전 상태가 됨 (ADD는 판매 종료)
	private int countUnhiddenReports(Long historyId) {
		List<Long> hiddenReported = loanReportRepository
				.findProductIdsByProductStatus(ProductStatus.HIDDEN, ReportStatus.RECEIVED);
		if (hiddenReported.isEmpty()) {
			return 0;
		}
		Map<Long, ProductSnapshot> oldestAfter = new LinkedHashMap<>();
		productSnapshotRepository.findByHistoryIdGreaterThanAndProductIdInOrderByHistoryIdAsc(historyId, hiddenReported)
				.forEach(s -> oldestAfter.putIfAbsent(s.getProductId(), s));

		Set<Long> unhidden = new HashSet<>();
		oldestAfter.forEach((productId, snapshot) -> {
			if (snapshot.getChangeType() != ChangeType.ADD
					&& ProductStatus.ON.name().equals(statusOf(snapshot.getBeforeData()))) {
				unhidden.add(productId);
			}
		});
		if (unhidden.isEmpty()) {
			return 0;
		}
		return Math.toIntExact(loanReportRepository.countByProductIdInAndReportStatus(unhidden, ReportStatus.RECEIVED));
	}

	// 변경 기록 JSON의 product_status 값 (없으면 null)
	private static String statusOf(String beforeData) {
		if (beforeData == null) return null;
		Matcher matcher = PRODUCT_STATUS.matcher(beforeData);
		return matcher.find() ? matcher.group(1) : null;
	}

	// 처리자 번호 → 이름 (탈퇴한 관리자는 이름이 비어 있어 목록에서 빠짐 → null)
	private Map<Long, String> getAdminNames(List<ProductUpdateHistory> histories) {
		List<Long> adminIds = histories.stream().map(ProductUpdateHistory::getAdminId)
				.filter(Objects::nonNull).distinct().toList();
		return adminRepository.findAllById(adminIds).stream()
				.filter(a -> a.getAdminName() != null)
				.collect(Collectors.toMap(Admin::getAdminId, Admin::getAdminName));
	}
}
