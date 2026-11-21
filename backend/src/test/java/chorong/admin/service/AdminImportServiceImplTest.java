package chorong.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import chorong.admin.dto.ImportCheckResponseDTO;
import chorong.admin.dto.ImportRequestDTO;
import chorong.admin.dto.ImportStatusResponseDTO;
import chorong.admin.dto.PublishRequestDTO;
import chorong.common.client.FastApiClient;
import chorong.common.dto.FastApiImportCheckResponseDTO;
import chorong.common.dto.FastApiImportResponseDTO;
import chorong.common.dto.FastApiVersionResponseDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.entity.Source;

/*
 * 최신 확인, 갱신 시작, 최근 작업, 반영 (ADMIN-04) / FastAPI 대신 가짜 FastApiClient
 */
class AdminImportServiceImplTest {

	private static final Long ADMIN_ID = 1L;
	private static final Long JOB_ID = 3L;

	private FastApiClient fastApiClient;
	private MemoryCache memoryCache;
	private AdminImportServiceImpl service;

	@BeforeEach
	void setUp() {
		fastApiClient = mock(FastApiClient.class);
		memoryCache = new MemoryCache();
		service = new AdminImportServiceImpl(fastApiClient, memoryCache);
		memoryCache.put(MemoryCache.RANKING, "RATE", "랭킹");
	}

	@Test
	void 같은_출처를_두_번_보내면_400() {
		// Given
		ImportRequestDTO request = new ImportRequestDTO(List.of(Source.KINFA, Source.KINFA));

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> service.startImport(ADMIN_ID, request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 최신_확인은_FastAPI가_준_최신_여부와_출처_결과_그대로() {
		// Given: 서민은 최신, 금감원은 새 공시월
		FastApiImportCheckResponseDTO.SourceCheck kinfa = new FastApiImportCheckResponseDTO.SourceCheck(
				"KINFA", null, true, "318", "318", 0, 0, null);
		FastApiImportCheckResponseDTO.SourceCheck fss = new FastApiImportCheckResponseDTO.SourceCheck(
				"FSS", null, false, "202611", "202612", null, null, null);
		when(fastApiClient.checkImport())
				.thenReturn(new FastApiImportCheckResponseDTO(null, List.of(kinfa, fss), true, null));

		// When
		ImportCheckResponseDTO response = service.checkImport();

		// Then
		assertEquals(List.of(true, 2, false),
				List.of(response.getNeedsRefresh(), response.getSources().size(), response.getSources().get(1).getIsLatest()));
	}

	@Test
	void 최근_작업은_FastAPI가_준_작업_번호와_상태_그대로() {
		// Given: 진행 중인 작업 3
		when(fastApiClient.getLatestImport())
				.thenReturn(new FastApiImportResponseDTO(JOB_ID, "RUNNING", 12L, null, null, null, null));

		// When
		ImportStatusResponseDTO response = service.getLatestImport();

		// Then
		assertEquals(List.of(JOB_ID, "RUNNING"), List.of(response.getJobId(), response.getJobStatus()));
	}

	@Test
	void 반영에_성공하면_상품_캐시_비움() {
		// Given
		when(fastApiClient.publishImport(any(), anyList(), any(), any())).thenReturn(new FastApiVersionResponseDTO(8L));

		// When
		service.publishImport(ADMIN_ID, JOB_ID, new PublishRequestDTO(List.of(1L, 2L), 7L));

		// Then
		assertNull(memoryCache.get(MemoryCache.RANKING, "RATE"));
	}

	@Test
	void 반영에_실패하면_캐시_그대로() {
		// Given
		when(fastApiClient.publishImport(any(), anyList(), any(), any()))
				.thenThrow(new BusinessException(ErrorCode.VERSION_CONFLICT));

		// When
		assertThrows(BusinessException.class,
				() -> service.publishImport(ADMIN_ID, JOB_ID, new PublishRequestDTO(List.of(1L), 7L)));

		// Then
		assertNotNull(memoryCache.get(MemoryCache.RANKING, "RATE"));
	}

	@Test
	void 반영_기준_버전은_받은_값_그대로_보냄() {
		// Given
		when(fastApiClient.publishImport(any(), anyList(), any(), any())).thenReturn(new FastApiVersionResponseDTO(8L));

		// When
		service.publishImport(ADMIN_ID, JOB_ID, new PublishRequestDTO(List.of(1L, 2L, 2L), 7L));

		// Then: 같은 번호는 한 번만, 기준 버전 7, 관리자 번호는 세션 값
		verify(fastApiClient).publishImport(JOB_ID, List.of(1L, 2L), 7L, ADMIN_ID);
	}
}
