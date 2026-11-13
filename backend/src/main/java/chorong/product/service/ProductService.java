package chorong.product.service;

import java.util.List;

import chorong.product.dto.ProductDetailResponseDTO;

public interface ProductService {

	// 상품 상세 (PROD-01). 없는 상품은 404
	ProductDetailResponseDTO getProduct(Long id);

	// 비교용 상품 1~2개 (COM-01). id가 1~2개가 아니면 400, 없는 상품은 404, 요청한 id 순서대로 응답
	List<ProductDetailResponseDTO> getCompareProducts(List<Long> ids);
}
