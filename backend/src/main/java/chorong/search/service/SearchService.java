package chorong.search.service;

import chorong.search.dto.FilterChipResponseDTO;
import chorong.search.dto.KeywordSearchRequestDTO;
import chorong.search.dto.KeywordSearchResponseDTO;
import chorong.search.dto.ProductSearchRequestDTO;
import chorong.search.dto.ProductSearchResponseDTO;

public interface SearchService {

	// SEARCH-01 상품 상세 검색. 모르는 칩 값, 한 필터에 칩 20개 초과, 모르는 rt, sort, 쪽 크기 50 초과는 400
	ProductSearchResponseDTO searchProducts(ProductSearchRequestDTO request);

	// SEARCH-02 간편 검색. 모르는 키워드, 6개 이상은 400, 충족 0건은 빈 목록
	KeywordSearchResponseDTO searchKeywords(KeywordSearchRequestDTO request);

	// SEARCH-03 필터 칩 목록 (메모리 캐시, 상품이 바뀌면 비움)
	FilterChipResponseDTO getFilterChips();
}
