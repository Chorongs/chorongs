package chorong.product.service;

import chorong.product.dto.ProductDetailResponseDTO;

public interface ProductService {

	// 상품 상세 (PROD-01). 없는 상품은 404
	ProductDetailResponseDTO getProduct(Long id);
}
