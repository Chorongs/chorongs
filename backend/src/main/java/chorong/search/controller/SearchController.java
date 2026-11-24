package chorong.search.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.common.dto.ApiResponse;
import chorong.search.dto.FilterChipResponseDTO;
import chorong.search.dto.KeywordSearchRequestDTO;
import chorong.search.dto.KeywordSearchResponseDTO;
import chorong.search.dto.ProductSearchRequestDTO;
import chorong.search.dto.ProductSearchResponseDTO;
import chorong.search.service.SearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SearchController {

	private final SearchService searchService;

	// SEARCH-01 상품 상세 검색 (로그인 필요 없음). ids 없는 GET /api/products (ids가 있으면 ProductController의 비교용 COM-01)
	// 쿼리 값 형식이 틀리면 400 (B2), 칩 값, 개수는 Service에서 확인 (B19)
	@GetMapping("/products")
	public ResponseEntity<ApiResponse<ProductSearchResponseDTO>> searchProducts(
			@Valid ProductSearchRequestDTO request) {
		return ResponseEntity.ok(ApiResponse.success(searchService.searchProducts(request)));
	}

	// SEARCH-03 필터 칩 목록 (/api/products/{id}보다 이 주소가 먼저 맞음)
	@GetMapping("/products/filters")
	public ResponseEntity<ApiResponse<FilterChipResponseDTO>> getFilterChips() {
		return ResponseEntity.ok(ApiResponse.success(searchService.getFilterChips()));
	}

	// SEARCH-02 간편 검색 (읽기만 하지만 키워드를 본문으로 받아 POST)
	@PostMapping("/recommendations/keywords")
	public ResponseEntity<ApiResponse<KeywordSearchResponseDTO>> searchKeywords(
			@Valid @RequestBody KeywordSearchRequestDTO request) {
		return ResponseEntity.ok(ApiResponse.success(searchService.searchKeywords(request)));
	}
}
