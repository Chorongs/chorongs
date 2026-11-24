package chorong.admin.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import chorong.admin.dto.AutoClosedHandleRequestDTO;
import chorong.admin.dto.AutoClosedResponseDTO;
import chorong.admin.service.AdminAutoClosedService;
import chorong.common.dto.ApiResponse;
import chorong.common.dto.PageInfo;
import chorong.common.util.AdminUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * /api/admin/auto-closed : 자동 내림 목록, 확인, 다시 게시 (ADMIN-10)
 */
@RestController
@RequestMapping("/api/admin/auto-closed")
@RequiredArgsConstructor
public class AdminAutoClosedController {

	private final AdminAutoClosedService adminAutoClosedService;

	/** 목록: filter UNCHECKED(기본), KEEP, REOPEN / page 1부터 */
	@GetMapping
	public ResponseEntity<ApiResponse<PageInfo<AutoClosedResponseDTO>>> getAutoClosed(
			@RequestParam(required = false) String filter,
			@RequestParam(defaultValue = "1") int page) {
		return ResponseEntity.ok(ApiResponse.success(adminAutoClosedService.getAutoClosed(filter, page)));
	}

	/** 확인(KEEP), 다시 게시(REOPEN) → 204 */
	@PatchMapping
	public ResponseEntity<Void> handleAutoClosed(@Valid @RequestBody AutoClosedHandleRequestDTO requestDTO,
			HttpServletRequest request) {
		adminAutoClosedService.handleAutoClosed(AdminUtil.getAdminId(request.getSession(false)), requestDTO);
		return ResponseEntity.noContent().build();
	}
}
