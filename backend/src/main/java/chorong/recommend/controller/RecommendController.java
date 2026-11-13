package chorong.recommend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.common.dto.ApiResponse;
import chorong.common.util.LoginUtil;
import chorong.common.util.RequestLimiter;
import chorong.recommend.dto.EligibilityResponseDTO;
import chorong.recommend.dto.RecommendRequestDTO;
import chorong.recommend.dto.RecommendResponseDTO;
import chorong.recommend.service.RecommendService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class RecommendController {

	private final RecommendService recommendService;
	private final RequestLimiter requestLimiter;

	// LOAN-01, 02 맞춤 추천 (비회원도 사용, 같은 세션 또는 IP 1분 10회 넘으면 429)
	@PostMapping("/recommendations")
	public ResponseEntity<ApiResponse<RecommendResponseDTO>> getRecommendations(
			@Valid @RequestBody RecommendRequestDTO request, HttpServletRequest httpRequest) {
		requestLimiter.check("recommend", httpRequest);
		// 비회원 요청에 세션을 새로 만들지 않게 getSession(false)
		RecommendResponseDTO response = recommendService.getRecommendations(request,
				LoginUtil.getLoginMember(httpRequest.getSession(false)));
		return ResponseEntity.ok(ApiResponse.success(response));
	}

	// LOAN-05 내 조건 판정 (숫자 아닌 id 400, 없거나 게시 상품 아님 404)
	@PostMapping("/products/{id}/eligibility")
	public ResponseEntity<ApiResponse<EligibilityResponseDTO>> getEligibility(@PathVariable Long id,
			@Valid @RequestBody RecommendRequestDTO request, HttpServletRequest httpRequest) {
		EligibilityResponseDTO response = recommendService.getEligibility(id, request,
				LoginUtil.getLoginMember(httpRequest.getSession(false)));
		return ResponseEntity.ok(ApiResponse.success(response));
	}
}
