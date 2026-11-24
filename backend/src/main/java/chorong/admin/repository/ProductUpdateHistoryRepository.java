package chorong.admin.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import chorong.admin.entity.ActionType;
import chorong.admin.entity.ProductUpdateHistory;

/*
 * product_update_history 테이블 Repository
 */
public interface ProductUpdateHistoryRepository extends JpaRepository<ProductUpdateHistory, Long> {

	// 마지막 이력 = 현재 버전 (ADMIN-04, 05)
	Optional<ProductUpdateHistory> findTopByOrderByHistoryIdDesc();

	// 종류별 이력 한 쪽 (ADMIN-05, 종류 없으면 findAll(Pageable))
	Page<ProductUpdateHistory> findByActionType(ActionType actionType, Pageable pageable);

	// 이 이력 뒤에 생긴 이력 수 = 되돌리면 취소되는 이력 수 (ADMIN-05)
	long countByHistoryIdGreaterThan(Long historyId);
}
