package chorong.admin.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import chorong.admin.dto.CatalogResponseDTO;
import chorong.admin.dto.HistoryResponseDTO;
import chorong.admin.dto.PublishResponseDTO;
import chorong.admin.dto.RollbackPreviewResponseDTO;
import chorong.admin.dto.RollbackRequestDTO;
import chorong.admin.entity.ActionType;
import chorong.admin.service.AdminCatalogService;
import chorong.common.dto.ApiResponse;
import chorong.common.dto.PageInfo;
import chorong.common.util.AdminUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/*
 * /api/admin/catalog/** : 게시 상품 현황, 반영 이력, 되돌리기 (ADMIN-04, 05)
 */
@RestController
@RequestMapping("/api/admin/catalog")
@RequiredArgsConstructor
public class AdminCatalogController {

	private final AdminCatalogService adminCatalogService;

	/** ADMIN-04 게시 상품 현황, 메뉴 옆 개수 */
	@GetMapping
	public ResponseEntity<ApiResponse<CatalogResponseDTO>> getCatalog(HttpServletRequest request) {
		return ResponseEntity.ok(ApiResponse.success(
				adminCatalogService.getCatalog(AdminUtil.getAdminId(request.getSession(false)))));
	}

	/** ADMIN-05 반영 이력: actionType (없으면 전체, 모르는 값 400), page (1부터) */
	@GetMapping("/versions")
	public ResponseEntity<ApiResponse<PageInfo<HistoryResponseDTO>>> getHistories(
			@RequestParam(required = false) ActionType actionType,
			@RequestParam(defaultValue = "1") int page) {
		return ResponseEntity.ok(ApiResponse.success(adminCatalogService.getHistories(actionType, page)));
	}

	/** ADMIN-05 되돌리기 미리보기: 확인 창 숫자 + 기준 버전 (마지막 이력 409, 없는 번호 404) */
	@GetMapping("/rollback-preview")
	public ResponseEntity<ApiResponse<RollbackPreviewResponseDTO>> getRollbackPreview(@RequestParam Long historyId) {
		return ResponseEntity.ok(ApiResponse.success(adminCatalogService.getRollbackPreview(historyId)));
	}

	/** ADMIN-05 되돌리기 (기준 버전은 미리보기의 baseVersion) → 새 버전 */
	@PostMapping("/rollback")
	public ResponseEntity<ApiResponse<PublishResponseDTO>> rollback(@Valid @RequestBody RollbackRequestDTO requestDTO,
			HttpServletRequest request) {
		Long adminId = AdminUtil.getAdminId(request.getSession(false));
		return ResponseEntity.ok(ApiResponse.success(adminCatalogService.rollback(adminId, requestDTO)));
	}
}
