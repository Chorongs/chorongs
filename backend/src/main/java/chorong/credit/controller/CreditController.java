package chorong.credit.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.common.dto.ApiResponse;
import chorong.credit.dto.CreditCheckRequestDTO;
import chorong.credit.dto.CreditCheckResponseDTO;
import chorong.credit.service.CreditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * 신용 셀프 진단 (CREDIT-01): POST /api/diagnosis/credit (비회원도 가능)
 * 요청 본문(답)은 로그에 남기지 않음 (B8)
 */
@RestController
@RequestMapping("/api/diagnosis")
@RequiredArgsConstructor
public class CreditController {

	private final CreditService creditService;

	@PostMapping("/credit")
	public ResponseEntity<ApiResponse<CreditCheckResponseDTO>> checkCredit(
			@Valid @RequestBody CreditCheckRequestDTO request) {
		return ResponseEntity.ok(ApiResponse.success(creditService.checkCredit(request)));
	}
}
