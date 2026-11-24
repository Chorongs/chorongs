package chorong.product.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;

public interface ProductTagRepository extends JpaRepository<ProductTag, Long> {

	// 상품에 붙은 태그 연결 목록
	List<ProductTag> findByProductId(Long productId);

	// 여러 상품의 태그 연결 (저장한 추천 목록, LOAN-04 / 최대 300개)
	List<ProductTag> findByProductIdIn(Collection<Long> productIds);

	// 해당 상태 상품의 (태그 번호, 상품 번호) 쌍 (필터 칩별 상품 수 세기, SEARCH-03). 결과 한 줄 = [Long tagId, Long productId]
	@Query("""
			select pt.tagId, pt.productId from ProductTag pt, LoanProduct p
			where p.productId = pt.productId and p.productStatus = :status
			""")
	List<Object[]> findTagPairsByProductStatus(@Param("status") ProductStatus status);

	List<ProductTag> findByTagIdIn(List<Long>  tagIds);
}
