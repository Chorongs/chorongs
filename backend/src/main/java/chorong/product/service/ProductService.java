package chorong.product.service;

import java.util.List;

import chorong.product.dto.ProductDetailResponseDTO;
import jakarta.servlet.http.HttpSession;

public interface ProductService {

	// 상품 상세 (PROD-01). 없는 상품은 404
	ProductDetailResponseDTO getProduct(Long id);

	// 비교용 상품 1~2개 (COM-01). id가 1~2개가 아니면 400, 없는 상품은 404, 요청한 id 순서대로 응답
	List<ProductDetailResponseDTO> getCompareProducts(List<Long> ids);

	// 상품 조회 기록 (RANK-03). 세션의 본 상품 목록에 있으면 무시, 없으면 목록에 넣고 조회수 +1
	void recordView(Long id, HttpSession session);
}
