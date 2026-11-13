package chorong.product.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;

public interface LoanProductRepository extends JpaRepository<LoanProduct, Long> {

	// 상태별 상품 목록 (추천 후보 = 게시 ON, LOAN-01)
	List<LoanProduct> findByProductStatus(ProductStatus productStatus);
}
