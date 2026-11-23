package chorong.calculator.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.calculator.dto.HomeLimitCalcHistoryRequestDTO;
import chorong.calculator.dto.HomeLimitCalcHistoryResponseDTO;
import chorong.calculator.service.HomeLimitCalcHistoryService;
import chorong.common.dto.ApiResponse;
import chorong.common.util.LoginUtil;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * CAL-08 내 집 대출한도 계산 기록 (회원만, /api/me/**는 LoginInterceptor가 비로그인 401)
 * 회원 번호는 세션에서만 꺼냄 (B3)
 */
@RestController
@RequestMapping("/api/me/home-calcs")
@RequiredArgsConstructor
public class HomeLimitCalcHistoryController {

	private final HomeLimitCalcHistoryService homeLimitCalcHistoryService;

	// 내 기록 목록
	@GetMapping
	public ResponseEntity<ApiResponse<HomeLimitCalcHistoryResponseDTO>> getHomeCalcs(HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		return ResponseEntity.ok(ApiResponse.success(homeLimitCalcHistoryService.getHomeCalcs(memberId)));
	}

	// 저장 -> 201 (본문 없음, 목록은 GET으로 다시 받음)
	@PostMapping
	public ResponseEntity<Void> saveHomeCalc(@Valid @RequestBody HomeLimitCalcHistoryRequestDTO request,
			HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		homeLimitCalcHistoryService.saveHomeCalc(memberId, request);
		return ResponseEntity.status(HttpStatus.CREATED).build();
	}

	// 1건 삭제 -> 204 (남의 기록, 없는 기록 404)
	@DeleteMapping("/{homeId}")
	public ResponseEntity<Void> deleteHomeCalc(@PathVariable Long homeId, HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		homeLimitCalcHistoryService.deleteHomeCalc(memberId, homeId);
		return ResponseEntity.noContent().build();
	}

	// 전체 삭제 -> 204
	@DeleteMapping
	public ResponseEntity<Void> deleteHomeCalcs(HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		homeLimitCalcHistoryService.deleteHomeCalcs(memberId);
		return ResponseEntity.noContent().build();
	}
}
