package chorong.credit.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.common.dto.ApiResponse;
import chorong.common.util.LoginUtil;
import chorong.credit.dto.DiagnosisReportRequestDTO;
import chorong.credit.dto.DiagnosisReportResponseDTO;
import chorong.credit.service.DiagnosisReportService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * 진단 결과 저장 (CREDIT-02): /api/me/reports/credit
 * 로그인 확인은 LoginInterceptor (/api/me/**), 회원 번호는 세션에서만 꺼냄 (B3)
 */
@RestController
@RequestMapping("/api/me/reports/credit")
@RequiredArgsConstructor
public class DiagnosisReportController {

	private final DiagnosisReportService diagnosisReportService;

	/** 내 리포트 조회, 없으면 204 */
	@GetMapping
	public ResponseEntity<ApiResponse<DiagnosisReportResponseDTO>> getReport(HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		return diagnosisReportService.getReport(memberId)
				.map(report -> ResponseEntity.ok(ApiResponse.success(report)))
				.orElseGet(() -> ResponseEntity.noContent().build());
	}

	/** 구간 저장 (회원당 1개 덮어쓰기) */
	@PutMapping
	public ResponseEntity<ApiResponse<DiagnosisReportResponseDTO>> saveReport(
			HttpSession session, @Valid @RequestBody DiagnosisReportRequestDTO request) {
		Long memberId = LoginUtil.getMemberId(session);
		return ResponseEntity.ok(ApiResponse.success(diagnosisReportService.saveReport(memberId, request)));
	}

	/** 내 리포트 삭제, 204 */
	@DeleteMapping
	public ResponseEntity<Void> deleteReport(HttpSession session) {
		Long memberId = LoginUtil.getMemberId(session);
		diagnosisReportService.discardReport(memberId);
		return ResponseEntity.noContent().build();
	}
}
