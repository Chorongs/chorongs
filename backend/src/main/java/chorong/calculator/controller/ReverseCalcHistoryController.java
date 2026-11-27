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

import chorong.calculator.dto.ReverseCalcHistoryRequestDTO;
import chorong.calculator.dto.ReverseCalcHistoryResponseDTO;
import chorong.calculator.service.ReverseCalcHistoryService;
import chorong.common.dto.ApiResponse;
import chorong.common.util.LoginUtil;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * CAL-07 상환능력 기반 대출 계산 기록 (회원만, /api/me/**는 LoginInterceptor가 비로그인 401)
 * 회원 번호는 세션에서만 꺼냄 (B3)
 */
@RestController
@RequestMapping("/api/me/reverse-calcs")
@RequiredArgsConstructor
public class ReverseCalcHistoryController {

	private final ReverseCalcHistoryService reverseCalcHistoryService;

	// 내 기록 목록
	@GetMapping
	public ResponseEntity<ApiResponse<ReverseCalcHistoryResponseDTO>> getReverseCalcs(HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		return ResponseEntity.ok(ApiResponse.success(reverseCalcHistoryService.getReverseCalcs(memberId)));
	}

	// 저장 -> 201 (본문 없음, 목록은 GET으로 다시 받음)
	@PostMapping
	public ResponseEntity<Void> saveReverseCalc(@Valid @RequestBody ReverseCalcHistoryRequestDTO request,
			HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		reverseCalcHistoryService.saveReverseCalc(memberId, request);
		return ResponseEntity.status(HttpStatus.CREATED).build();
	}

	// 같은 기록을 이미 저장했는지 -> 200 + true/false (읽기만, 저장할 때와 같은 본문). 계산기 화면이 결과를 보여 줄 때 [결과 저장] 버튼을 미리 잠그려고 씀
	@PostMapping("/check")
	public ResponseEntity<ApiResponse<Boolean>> checkReverseCalc(@Valid @RequestBody ReverseCalcHistoryRequestDTO request, HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		return ResponseEntity.ok(ApiResponse.success(reverseCalcHistoryService.hasSavedReverseCalc(memberId, request)));
	}

	// 1건 삭제 -> 204 (남의 기록, 없는 기록 404)
	@DeleteMapping("/{reverseId}")
	public ResponseEntity<Void> deleteReverseCalc(@PathVariable Long reverseId, HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		reverseCalcHistoryService.deleteReverseCalc(memberId, reverseId);
		return ResponseEntity.noContent().build();
	}

	// 전체 삭제 -> 204
	@DeleteMapping
	public ResponseEntity<Void> deleteReverseCalcs(HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		reverseCalcHistoryService.deleteReverseCalcs(memberId);
		return ResponseEntity.noContent().build();
	}
}
