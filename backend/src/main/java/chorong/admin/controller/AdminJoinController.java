package chorong.admin.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.admin.dto.AdminJoinRequestDTO;
import chorong.admin.dto.AdminJoinResponseDTO;
import chorong.admin.dto.AdminJoinTokenRequestDTO;
import chorong.admin.entity.AdminStatus;
import chorong.admin.service.AdminJoinService;
import chorong.common.dto.ApiResponse;
import chorong.common.util.AdminUtil;
import chorong.common.util.RequestLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * /api/admin/join/** : 가입 인증 토큰, 가입 신청 (ADMIN-07) / 로그인 없이 부름 (AdminInterceptor 제외 주소)
 */
@RestController
@RequestMapping("/api/admin/join")
@RequiredArgsConstructor
public class AdminJoinController {

	private final AdminJoinService adminJoinService;
	private final RequestLimiter requestLimiter;

	/** 가입 인증 토큰: 같은 세션(비회원 IP) 1분 10회 + 같은 이메일, IP 60초에 한 번 (B10) → 204 */
	@PostMapping("/token")
	public ResponseEntity<Void> requestJoinToken(@Valid @RequestBody AdminJoinTokenRequestDTO requestDTO,
			HttpServletRequest request) {
		requestLimiter.check("adminJoin", request);
		requestLimiter.checkOncePerMinute("adminJoinEmail", AdminUtil.normalizeEmail(requestDTO.getEmail()));
		requestLimiter.checkOncePerMinute("adminJoinIp", request.getRemoteAddr());
		adminJoinService.requestJoinToken(request.getSession(), requestDTO);
		return ResponseEntity.noContent().build();
	}

	/** 가입 신청: 첫 관리자면 바로 로그인 (세션 아이디 새로 발급, B5) */
	@PostMapping
	public ResponseEntity<ApiResponse<AdminJoinResponseDTO>> join(@Valid @RequestBody AdminJoinRequestDTO requestDTO,
			HttpServletRequest request) {
		requestLimiter.check("adminJoin", request);
		AdminJoinResponseDTO response = adminJoinService.join(request.getSession(false), requestDTO);
		if (response.getAdminStatus() == AdminStatus.ACTIVE) {
			request.changeSessionId();
		}
		return ResponseEntity.ok(ApiResponse.success(response));
	}
}
