package chorong.product.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.product.entity.ProductRate;
import chorong.product.entity.RateKind;

public interface ProductRateRepository extends JpaRepository<ProductRate, Long> {

	// 상품의 금리 목록 (종류별)
	List<ProductRate> findByProductIdAndRateKind(Long productId, RateKind rateKind);
}
