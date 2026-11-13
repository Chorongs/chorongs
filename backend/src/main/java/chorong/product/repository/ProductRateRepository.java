package chorong.product.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.product.entity.ProductRate;
import chorong.product.entity.RateKind;

public interface ProductRateRepository extends JpaRepository<ProductRate, Long> {

	// 상품의 금리 목록 (종류별)
	List<ProductRate> findByProductIdAndRateKind(Long productId, RateKind rateKind);

	// 종류별 금리 전체 (추천 후보 캐시, LOAN-01 / 상품 번호 IN은 1,000개 제한이 있어 전체를 읽음)
	List<ProductRate> findByRateKind(RateKind rateKind);
}
