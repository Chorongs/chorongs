package chorong.product.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.product.entity.ProductTag;

public interface ProductTagRepository extends JpaRepository<ProductTag, Long> {

	// 상품에 붙은 태그 연결 목록
	List<ProductTag> findByProductId(Long productId);

	// 여러 상품의 태그 연결 (저장한 추천 목록, LOAN-04 / 최대 300개)
	List<ProductTag> findByProductIdIn(Collection<Long> productIds);
}
