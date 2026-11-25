package chorong.product.service;

import java.util.*;
import chorong.common.util.SessionConst;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.product.dto.ProductDetailResponseDTO;
import chorong.product.entity.LoanProduct;
import chorong.product.entity.ProductRate;
import chorong.product.entity.ProductStatus;
import chorong.product.entity.ProductTag;
import chorong.product.entity.RateKind;
import chorong.product.entity.Tag;
import chorong.product.repository.LoanProductRepository;
import chorong.product.repository.ProductRateRepository;
import chorong.product.repository.ProductTagRepository;
import chorong.product.repository.TagRepository;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

	private static final int COMPARE_MIN = 1;
	private static final int COMPARE_MAX = 2;

	private final LoanProductRepository loanProductRepository;
	private final TagRepository tagRepository;
	private final ProductTagRepository productTagRepository;
	private final ProductRateRepository productRateRepository;

	@Override
	@Transactional(readOnly = true)
	public ProductDetailResponseDTO getProduct(Long id) {
		LoanProduct product = loanProductRepository.findById(id)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

		// 숨김 상품은 번호, 금융사, 상품명, 상태만 응답 (태그, 금리는 조회하지 않음)
		if (product.getProductStatus() == ProductStatus.HIDDEN) {
			return ProductDetailResponseDTO.from(product, List.of(), List.of());
		}

		List<Long> tagIds = productTagRepository.findByProductId(id).stream()
				.map(ProductTag::getTagId)
				.toList();
		List<Tag> tags = tagIds.isEmpty() ? List.of() : tagRepository.findByTagIdInOrderByTagId(tagIds);
		List<ProductRate> creditRates = productRateRepository.findByProductIdAndRateKind(id, RateKind.CREDIT);

		return ProductDetailResponseDTO.from(product, tags, creditRates);
	}

	// COM-01: 상태별 응답(판매 종료는 상세 + 상태, 숨김은 번호/금융사/상품명/상태만)과 404는 getProduct와 같음
	@Override
	@Transactional(readOnly = true)
	public List<ProductDetailResponseDTO> getCompareProducts(List<Long> ids) {
		validateCompareIds(ids);
		return ids.stream().map(this::getProduct).toList();
	}

	/*
	 * RANK-03 처리 순서 (be_product.md)
	 * 1. 세션의 SessionConst.VIEWED_PRODUCTS (상품 번호 Set)에 있으면 무시
	 * 2. 없으면 목록에 넣고 view_count + 1 (LoanProductRepository에 @Modifying @Query 한 줄 UPDATE, 동시 요청 안전)
	 * 세션에 목록이 아직 없으면(첫 요청) 새로 만들어 세션에 넣어야 함 / 비회원 포함, IP 제한은 하지 않음
	 */
	@Override
	@Transactional
	public void recordView(Long productId, HttpSession session) {
		Optional<LoanProduct> product =
				loanProductRepository.findByProductIdAndProductStatus(productId ,ProductStatus.CLOSED);
				if(product.isPresent()) throw new BusinessException(ErrorCode.NOT_FOUND);

		Set<Long> viewed = getViewedProducts(session);
		if (viewed.add(productId)) {          // add는 새로 넣었으면 true, 이미 있으면 false
			int updateRow = loanProductRepository.increaseViewCount(productId);
			if (updateRow == 0) {
				viewed.remove(productId);
				throw new  BusinessException(ErrorCode.NOT_FOUND);
			}
		}  // viewed.add가 false 라면 아무것도 하지 않음
	}

	/** COM-01 처리 순서 1: 비교용 id는 1~2개만 허용 (없거나 3개 이상이면 400), 빈 값(ids=,1)과 같은 상품 두 번도 400 */
	static void validateCompareIds(List<Long> ids) {
		if (ids == null || ids.size() < COMPARE_MIN || ids.size() > COMPARE_MAX) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		if (ids.stream().anyMatch(Objects::isNull)) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		if (ids.stream().distinct().count() != ids.size()) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
	}

	//RANK-03에서 사용
	// 세션의 본 상품 번호 Set을 꺼냄 (없거나 Set이 아니면 빈 Set), 항상 Set<Long>으로 돌려줌
	private Set<Long> getViewedProducts(HttpSession session) {
		Set<Long> viewed = new HashSet<>();                            // 3. 기본은 빈 Set
		if (session.getAttribute(SessionConst.VIEWED_PRODUCTS) instanceof Set<?> saved) {  // 1~2. Object를 Set인지 확인 (null이면 false)
			for (Object item : saved) {
				if (item instanceof Long productId) {                           // 2. Long인 것만 옮겨 담음 (타입 확인)
					viewed.add(productId);
				}
			}
		}
		session.setAttribute(SessionConst.VIEWED_PRODUCTS, viewed);             // 세션에 다시 넣음
		return viewed;
	}
}
