package chorong.report.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import chorong.product.entity.ProductStatus;
import chorong.report.entity.LoanReport;
import chorong.report.entity.ReportStatus;

/*
 * loan_report 테이블 Repository (CHORONG-57에서 관리자 개수용으로 먼저 만듦, 신고 기능 메서드는 CHORONG-50에서 추가)
 */
public interface LoanReportRepository extends JpaRepository<LoanReport, Long> {

	// 미처리 신고가 기준 건수 이상인 상품 번호 (메뉴 옆 '미처리 신고 상품 수', ADMIN-04)
	@Query("SELECT r.productId FROM LoanReport r WHERE r.reportStatus = :reportStatus"
			+ " GROUP BY r.productId HAVING COUNT(r) >= :minCount")
	List<Long> findProductIdsWithReports(@Param("reportStatus") ReportStatus reportStatus,
			@Param("minCount") long minCount);

	// 지금 이 상태이면서 그 신고 상태가 있는 상품 번호 (숨김 + 미처리 신고, ADMIN-05)
	@Query("SELECT DISTINCT r.productId FROM LoanReport r, LoanProduct p"
			+ " WHERE r.productId = p.productId AND p.productStatus = :productStatus AND r.reportStatus = :reportStatus")
	List<Long> findProductIdsByProductStatus(@Param("productStatus") ProductStatus productStatus,
			@Param("reportStatus") ReportStatus reportStatus);

	// 고른 상품들의 신고 건수 (되돌리면 숨김이 풀리는 상품의 미처리 신고 건수, ADMIN-05)
	long countByProductIdInAndReportStatus(Collection<Long> productIds, ReportStatus reportStatus);
}
