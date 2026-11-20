package chorong.admin.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.admin.dto.ImportRequestDTO;
import chorong.admin.dto.ImportStatusResponseDTO;
import chorong.admin.dto.PublishRequestDTO;
import chorong.admin.dto.PublishResponseDTO;
import chorong.admin.service.AdminImportService;
import chorong.common.dto.ApiResponse;
import chorong.common.util.AdminUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * /api/admin/imports/** : 불러오기 시작, 진행, 비교 결과, 반영 (ADMIN-04)
 */
@RestController
@RequestMapping("/api/admin/imports")
@RequiredArgsConstructor
public class AdminImportController {

	private final AdminImportService adminImportService;

	/** 불러오기 시작 → 작업 번호 (jobId만 채움) */
	@PostMapping
	public ResponseEntity<ApiResponse<ImportStatusResponseDTO>> startImport(
			@Valid @RequestBody ImportRequestDTO requestDTO, HttpServletRequest request) {
		Long adminId = AdminUtil.getAdminId(request.getSession(false));
		return ResponseEntity.ok(ApiResponse.success(adminImportService.startImport(adminId, requestDTO)));
	}

	/** 진행 확인, 비교 결과 */
	@GetMapping("/{id}")
	public ResponseEntity<ApiResponse<ImportStatusResponseDTO>> getImport(@PathVariable Long id) {
		return ResponseEntity.ok(ApiResponse.success(adminImportService.getImport(id)));
	}

	/** 고른 항목만 사이트에 반영 → 새 버전 */
	@PostMapping("/{id}/publish")
	public ResponseEntity<ApiResponse<PublishResponseDTO>> publishImport(@PathVariable Long id,
			@Valid @RequestBody PublishRequestDTO requestDTO, HttpServletRequest request) {
		Long adminId = AdminUtil.getAdminId(request.getSession(false));
		return ResponseEntity.ok(ApiResponse.success(adminImportService.publishImport(adminId, id, requestDTO)));
	}
}
