package chorong.admin.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.admin.dto.AdminLoginRequestDTO;
import chorong.admin.dto.AdminResponseDTO;
import chorong.admin.dto.AdminTokenRequestDTO;
import chorong.admin.service.AdminAuthService;
import chorong.common.dto.ApiResponse;
import chorong.common.util.AdminUtil;
import chorong.common.util.RequestLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * /api/admin/auth/** : 토큰 요청, 토큰 로그인, 세션 확인, 해제 (ADMIN-02, 03)
 * AdminInterceptor 확인에서 빠진 주소라 세션 확인은 서비스가 직접 함
 */
@RestController
@RequestMapping("/api/admin/auth")
@RequiredArgsConstructor
public class AdminAuthController {

	private final AdminAuthService adminAuthService;
	private final RequestLimiter requestLimiter;

	/** ADMIN-02 토큰 요청: 같은 세션(비회원은 IP) 1분 10회, 같은 이메일 60초에 한 번 (B10, B17) → 204 */
	@PostMapping("/token")
	public ResponseEntity<Void> requestToken(@Valid @RequestBody AdminTokenRequestDTO requestDTO,
			HttpServletRequest request) {
		requestLimiter.check("adminToken", request);
		requestLimiter.checkOncePerMinute("adminTokenEmail", AdminUtil.normalizeEmail(requestDTO.getEmail()));
		adminAuthService.requestToken(requestDTO);
		return ResponseEntity.noContent().build();
	}

	/** ADMIN-03 토큰 로그인: 같은 세션(비회원은 IP) 1분 10회 (B10) */
	@PostMapping
	public ResponseEntity<ApiResponse<AdminResponseDTO>> login(@Valid @RequestBody AdminLoginRequestDTO requestDTO,
			HttpServletRequest request) {
		requestLimiter.check("adminLogin", request);
		AdminResponseDTO response = adminAuthService.login(request.getSession(), requestDTO);
		request.changeSessionId();	// 로그인 성공 시 세션 아이디 새로 발급 (세션 고정 공격 방지, B5)
		return ResponseEntity.ok(ApiResponse.success(response));
	}

	/** ADMIN-03 세션 확인: 관리자 정보, 만료 시각 */
	@GetMapping
	public ResponseEntity<ApiResponse<AdminResponseDTO>> getSession(HttpServletRequest request) {
		return ResponseEntity.ok(ApiResponse.success(adminAuthService.getSession(request.getSession(false))));
	}

	/** ADMIN-03 해제 (로그아웃): 세션 무효화 → 204 */
	@DeleteMapping
	public ResponseEntity<Void> logout(HttpServletRequest request) {
		adminAuthService.logout(request.getSession(false));
		return ResponseEntity.noContent().build();
	}
}
