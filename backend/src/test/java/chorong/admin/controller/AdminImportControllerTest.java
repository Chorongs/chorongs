package chorong.admin.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.admin.dto.ImportCheckResponseDTO;
import chorong.admin.service.AdminImportService;
import chorong.common.exception.GlobalExceptionHandler;

/*
 * ADMIN-04 GET /api/admin/imports/check 주소 테스트: 고정 주소 'check'가 '{id}'(작업 번호)보다 먼저 맞춰지는지
 * Service는 Mockito 가짜 (인터셉터는 standalone에 없어 세션 없이 호출)
 */
class AdminImportControllerTest {

	private AdminImportService adminImportService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		adminImportService = mock(AdminImportService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new AdminImportController(adminImportService))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	@Test
	void imports_check_주소는_작업_번호가_아니라_최신_확인으로_간다() throws Exception {
		// Given
		when(adminImportService.checkImport()).thenReturn(new ImportCheckResponseDTO(null, List.of(), false, null));

		// When
		mockMvc.perform(get("/api/admin/imports/check"));

		// Then
		verify(adminImportService).checkImport();
	}
}
