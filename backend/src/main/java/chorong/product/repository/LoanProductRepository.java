package chorong.product.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductStatus;

public interface LoanProductRepository extends JpaRepository<LoanProduct, Long> {

	// 상태별 상품 목록 (추천 후보 = 게시 ON, LOAN-01)
	List<LoanProduct> findByProductStatus(ProductStatus productStatus);

	/*
	 * 상세 검색 (SEARCH-01): 게시 상품 중 금리 탭, 검색어, 필터에 맞는 상품을 쪽 나눠 조회
	 * - rateMode: 0 전체 / 1 금리 숫자 있는 상품 (NUM) / 2 금리 숫자 없는 상품 (MEMO)
	 * - 검색어: useQ가 1이면 q(소문자)가 상품명, 취급기관명에 들어 있거나, 상품에 붙은 칩 중 qTagIds에 있는 것 (locate는 글자 그대로 찾기라 %, _ 걱정 없음)
	 * - 필터: 고른 필터마다 칩 번호(tagIds)를 모아 보내고, 상품이 가진 그 칩들의 '태그 종류 수'가 고른 필터 수(groupCount)와 같으면 통과
	 *   (같은 필터 안 여러 값은 하나라도, 다른 필터끼리는 모두 맞아야 함. 필터마다 태그 종류가 달라서 가능)
	 * - 비교함 기준: useCmp가 1이면 cmpIds(비교함 상품)는 항상 통과, 그 밖의 상품은 '자금 용도 칩이 cmpPurposeIds(기준 상품의 용도 칩)와 하나라도 겹침'
	 *   그리고 '상환 방식 칩이 없거나(세 방식 모두 가능, allMethodIds = 원리금균등, 원금균등, 만기일시 칩에 하나도 안 붙음) cmpMethodIds(기준 상품의 방식 칩)와 하나라도 겹침'
	 * - 비어 있는 목록은 -1 하나를 넣어 보냄 (빈 IN 목록 방지), 정렬은 Pageable의 Sort (정해진 값 -> 컬럼)
	 * - 모든 값은 :이름 바인딩 (B1)
	 */
	@Query("""
			select p from LoanProduct p
			where p.productStatus = :status
			  and (:rateMode = 0
			       or (:rateMode = 1 and (p.rateMin is not null or p.rateMax is not null))
			       or (:rateMode = 2 and p.rateMin is null and p.rateMax is null))
			  and (:useQ = 0
			       or locate(:q, lower(p.productName)) > 0
			       or locate(:q, lower(p.companyName)) > 0
			       or exists (select 1 from ProductTag pq where pq.productId = p.productId and pq.tagId in :qTagIds))
			  and (:useTags = 0
			       or (select count(distinct t.tagType) from ProductTag pt, Tag t
			           where pt.productId = p.productId and t.tagId = pt.tagId and pt.tagId in :tagIds) = :groupCount)
				  and (:useCmp = 0
				       or p.productId in :cmpIds
				       or (exists (select 1 from ProductTag cp where cp.productId = p.productId and cp.tagId in :cmpPurposeIds)
				           and (not exists (select 1 from ProductTag am where am.productId = p.productId and am.tagId in :allMethodIds)
				                or exists (select 1 from ProductTag cm where cm.productId = p.productId and cm.tagId in :cmpMethodIds))))
			""")
	Page<LoanProduct> searchProducts(@Param("status") ProductStatus status, @Param("rateMode") int rateMode,
			@Param("useQ") int useQ, @Param("q") String q, @Param("qTagIds") Collection<Long> qTagIds,
			@Param("useTags") int useTags, @Param("tagIds") Collection<Long> tagIds,
			@Param("groupCount") long groupCount, @Param("useCmp") int useCmp, @Param("cmpIds") Collection<Long> cmpIds,
			@Param("cmpPurposeIds") Collection<Long> cmpPurposeIds, @Param("allMethodIds") Collection<Long> allMethodIds,
			@Param("cmpMethodIds") Collection<Long> cmpMethodIds, Pageable pageable);
}
