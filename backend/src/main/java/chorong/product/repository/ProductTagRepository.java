package chorong.product.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.product.entity.ProductTag;

public interface ProductTagRepository extends JpaRepository<ProductTag, Long> {

	// 상품에 붙은 태그 연결 목록
	List<ProductTag> findByProductId(Long productId);
}
