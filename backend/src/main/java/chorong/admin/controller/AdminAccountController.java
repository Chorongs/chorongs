package chorong.admin.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import chorong.admin.dto.AdminRemoveRequestDTO;
import chorong.admin.dto.AdminResponseDTO;
import chorong.admin.dto.AdminRoleRequestDTO;
import chorong.admin.entity.AdminStatus;
import chorong.admin.service.AdminAccountService;
import chorong.common.dto.ApiResponse;
import chorong.common.util.AdminUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * /api/admin/admins/** (승인권자만, AdminInterceptor가 403), /api/admin/me (ADMIN-08, 09)
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminAccountController {

	private final AdminAccountService adminAccountService;

	/** ADMIN-08 관리자 목록: status PENDING, ACTIVE (없으면 둘 다) */
	@GetMapping("/admins")
	public ResponseEntity<ApiResponse<List<AdminResponseDTO>>> getAdmins(
			@RequestParam(required = false) AdminStatus status) {
		return ResponseEntity.ok(ApiResponse.success(adminAccountService.getAdmins(status)));
	}

	/** ADMIN-08 가입 승인 → 204 */
	@PostMapping("/admins/{id}/approve")
	public ResponseEntity<Void> approveAdmin(@PathVariable Long id, @Valid @RequestBody AdminRoleRequestDTO requestDTO,
			HttpServletRequest request) {
		adminAccountService.approveAdmin(AdminUtil.getAdminId(request.getSession(false)), id, requestDTO);
		return ResponseEntity.noContent().build();
	}

	/** ADMIN-08 역할 바꾸기 → 204 */
	@PatchMapping("/admins/{id}/role")
	public ResponseEntity<Void> changeRole(@PathVariable Long id, @Valid @RequestBody AdminRoleRequestDTO requestDTO) {
		adminAccountService.changeRole(id, requestDTO);
		return ResponseEntity.noContent().build();
	}

	/** ADMIN-08 잠금 풀기 → 204 */
	@PostMapping("/admins/{id}/unlock")
	public ResponseEntity<Void> unlockAdmin(@PathVariable Long id) {
		adminAccountService.unlockAdmin(id);
		return ResponseEntity.noContent().build();
	}

	/** ADMIN-08 가입 거절 (승인 대기만) → 204 */
	@PostMapping("/admins/{id}/reject")
	public ResponseEntity<Void> rejectAdmin(@PathVariable Long id) {
		adminAccountService.rejectAdmin(id);
		return ResponseEntity.noContent().build();
	}

	/** ADMIN-09 해제 (정상 관리자만) → 204 */
	@DeleteMapping("/admins/{id}")
	public ResponseEntity<Void> removeAdmin(@PathVariable Long id) {
		adminAccountService.removeAdmin(id);
		return ResponseEntity.noContent().build();
	}

	/** ADMIN-09 내 계정 */
	@GetMapping("/me")
	public ResponseEntity<ApiResponse<AdminResponseDTO>> getMe(HttpServletRequest request) {
		return ResponseEntity.ok(ApiResponse.success(
				adminAccountService.getMe(AdminUtil.getLoginAdmin(request.getSession(false)))));
	}

	/** ADMIN-09 본인 탈퇴 (확인용 내 이메일) → 204 */
	@DeleteMapping("/me")
	public ResponseEntity<Void> withdraw(@Valid @RequestBody AdminRemoveRequestDTO requestDTO,
			HttpServletRequest request) {
		adminAccountService.withdraw(request.getSession(false), requestDTO);
		return ResponseEntity.noContent().build();
	}
}
