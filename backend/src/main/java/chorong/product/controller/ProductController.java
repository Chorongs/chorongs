package chorong.product.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.common.dto.ApiResponse;
import chorong.product.dto.ProductDetailResponseDTO;
import chorong.product.service.ProductService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

	private final ProductService productService;

	// PROD-01 상품 상세 (숫자 아닌 id는 400, 없는 상품은 404)
	@GetMapping("/{id}")
	public ResponseEntity<ApiResponse<ProductDetailResponseDTO>> getProduct(@PathVariable Long id) {
		return ResponseEntity.ok(ApiResponse.success(productService.getProduct(id)));
	}
}
