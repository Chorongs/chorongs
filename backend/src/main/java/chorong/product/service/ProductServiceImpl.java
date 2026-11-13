package chorong.product.service;

import java.util.List;

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

	/** COM-01 처리 순서 1: 비교용 id는 1~2개만 허용 (없거나 3개 이상이면 400), 같은 상품 두 번도 400 */
	static void validateCompareIds(List<Long> ids) {
		if (ids == null || ids.size() < COMPARE_MIN || ids.size() > COMPARE_MAX) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		if (ids.stream().distinct().count() != ids.size()) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
	}
}
