package chorong.admin.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import chorong.admin.entity.ActionType;
import chorong.admin.entity.CheckResult;
import chorong.admin.entity.ProductSnapshot;

/*
 * product_snapshot 테이블 Repository
 * 이력 종류(action_type)는 product_update_history에 있어서 두 테이블을 history_id로 같이 봄 (연관관계 매핑 없이 JPQL)
 */
public interface ProductSnapshotRepository extends JpaRepository<ProductSnapshot, Long> {

	// 확인 전 변경 기록 한 쪽 (자동 내림 확인 목록, 확인 전 개수 ADMIN-10, 04)
	@Query(value = "SELECT s FROM ProductSnapshot s, ProductUpdateHistory h"
			+ " WHERE s.historyId = h.historyId AND h.actionType = :actionType AND s.checkResult IS NULL"
			+ " ORDER BY s.snapshotId DESC",
			countQuery = "SELECT COUNT(s) FROM ProductSnapshot s, ProductUpdateHistory h"
			+ " WHERE s.historyId = h.historyId AND h.actionType = :actionType AND s.checkResult IS NULL")
	Page<ProductSnapshot> findUnchecked(@Param("actionType") ActionType actionType, Pageable pageable);

	// 확인 결과별 변경 기록 한 쪽 (확인함 KEEP, 다시 게시함 REOPEN, ADMIN-10)
	@Query(value = "SELECT s FROM ProductSnapshot s, ProductUpdateHistory h"
			+ " WHERE s.historyId = h.historyId AND h.actionType = :actionType AND s.checkResult = :checkResult"
			+ " ORDER BY s.snapshotId DESC",
			countQuery = "SELECT COUNT(s) FROM ProductSnapshot s, ProductUpdateHistory h"
			+ " WHERE s.historyId = h.historyId AND h.actionType = :actionType AND s.checkResult = :checkResult")
	Page<ProductSnapshot> findChecked(@Param("actionType") ActionType actionType,
			@Param("checkResult") CheckResult checkResult, Pageable pageable);

	// 고른 상품들의 확인 전 변경 기록 (확인, 다시 게시 ADMIN-10)
	@Query("SELECT s FROM ProductSnapshot s, ProductUpdateHistory h"
			+ " WHERE s.historyId = h.historyId AND h.actionType = :actionType AND s.checkResult IS NULL"
			+ " AND s.productId IN :productIds")
	List<ProductSnapshot> findUncheckedByProductIds(@Param("actionType") ActionType actionType,
			@Param("productIds") Collection<Long> productIds);

	// 확인 전인 기록만 확인 처리: 먼저 처리된 행은 안 바뀌어서 바뀐 줄 수로 동시 처리를 알 수 있음 (ADMIN-10, B9)
	@Modifying
	@Query("UPDATE ProductSnapshot s SET s.checkResult = :checkResult, s.checkedBy = :adminId, s.checkedAt = :checkedAt"
			+ " WHERE s.snapshotId IN :snapshotIds AND s.checkResult IS NULL")
	int checkUnchecked(@Param("snapshotIds") Collection<Long> snapshotIds, @Param("checkResult") CheckResult checkResult,
			@Param("adminId") Long adminId, @Param("checkedAt") LocalDateTime checkedAt);

	// 이 이력 뒤 변경 기록의 상품 수 = 되돌리면 바뀌는 상품 수 (ADMIN-05)
	@Query("SELECT COUNT(DISTINCT s.productId) FROM ProductSnapshot s WHERE s.historyId > :historyId")
	long countChangedProductsAfter(@Param("historyId") Long historyId);

	// 이 이력 뒤 고른 상품들의 변경 기록, 오래된 것부터 (되돌리면 그 상품이 어떤 상태가 되는지, ADMIN-05)
	List<ProductSnapshot> findByHistoryIdGreaterThanAndProductIdInOrderByHistoryIdAsc(Long historyId,
			Collection<Long> productIds);
}
