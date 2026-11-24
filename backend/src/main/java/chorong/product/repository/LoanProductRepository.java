package chorong.product.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.Source;

public interface LoanProductRepository extends JpaRepository<LoanProduct, Long> {

	// 상태별 상품 목록 (추천 후보 = 게시 ON, LOAN-01)
	List<LoanProduct> findByProductStatus(ProductStatus productStatus);

	// 출처별 상품 수 (게시 상품 현황, ADMIN-04)
	long countBySourceAndProductStatus(Source source, ProductStatus productStatus);

	// 공시 종료일이 기준 시각 전인 상품 (자동 내림 = 게시 + 종료일이 어제 이전, BAT-02)
	List<LoanProduct> findByProductStatusAndDiscloseEndBefore(ProductStatus productStatus, LocalDateTime time);
}
