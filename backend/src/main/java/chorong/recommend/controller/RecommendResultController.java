package chorong.recommend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.common.dto.ApiResponse;
import chorong.common.util.LoginUtil;
import chorong.recommend.dto.RecommendSaveRequestDTO;
import chorong.recommend.dto.RecommendSaveResponseDTO;
import chorong.recommend.dto.SavedRecommendResponseDTO;
import chorong.recommend.service.RecommendResultService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * LOAN-04 추천 결과 저장 (회원만, /api/me/**는 LoginInterceptor가 비로그인 401)
 * 회원 번호는 세션에서만 꺼냄 (B3)
 */
@RestController
@RequestMapping("/api/me/recommendations")
@RequiredArgsConstructor
public class RecommendResultController {

	private final RecommendResultService recommendResultService;

	// 내 저장 목록
	@GetMapping
	public ResponseEntity<ApiResponse<SavedRecommendResponseDTO>> getRecommendResults(HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		return ResponseEntity.ok(ApiResponse.success(recommendResultService.getRecommendResults(memberId)));
	}

	// 저장 -> 201 + saveId
	@PostMapping
	public ResponseEntity<ApiResponse<RecommendSaveResponseDTO>> saveRecommendResult(
			@Valid @RequestBody RecommendSaveRequestDTO request, HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		Long saveId = recommendResultService.saveRecommendResult(memberId, request);
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(new RecommendSaveResponseDTO(saveId)));
	}

	// 저장 1개 삭제 -> 204 (남의 저장, 없는 저장 404)
	@DeleteMapping("/{saveId}")
	public ResponseEntity<Void> deleteRecommendResult(@PathVariable Long saveId, HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		recommendResultService.deleteRecommendResult(memberId, saveId);
		return ResponseEntity.noContent().build();
	}

	// 전체 삭제 -> 204
	@DeleteMapping
	public ResponseEntity<Void> deleteRecommendResults(HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		recommendResultService.deleteRecommendResults(memberId);
		return ResponseEntity.noContent().build();
	}
}
