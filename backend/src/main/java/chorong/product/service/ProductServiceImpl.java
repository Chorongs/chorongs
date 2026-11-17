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
}
