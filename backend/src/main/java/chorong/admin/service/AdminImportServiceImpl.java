package chorong.admin.service;

import java.util.List;

import org.springframework.stereotype.Service;

import chorong.admin.dto.ImportRequestDTO;
import chorong.admin.dto.ImportStatusResponseDTO;
import chorong.admin.dto.PublishRequestDTO;
import chorong.admin.dto.PublishResponseDTO;
import chorong.common.client.FastApiClient;
import chorong.common.dto.FastApiVersionResponseDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.product.entity.Source;
import lombok.RequiredArgsConstructor;

/*
 * DB는 FastAPI가 씀 (import_job, import_item, 상품 테이블) → 여기는 @Transactional 없음
 * FastAPI 오류 변환(409, 422, 404, 503)은 FastApiClient 안에서 끝남
 */
@Service
@RequiredArgsConstructor
public class AdminImportServiceImpl implements AdminImportService {

	private final FastApiClient fastApiClient;
	private final MemoryCache memoryCache;

	@Override
	public ImportStatusResponseDTO startImport(Long adminId, ImportRequestDTO request) {
		List<String> sources = request.getSources().stream().map(Source::name).toList();
		if (sources.stream().distinct().count() != sources.size()) {	// 같은 출처 두 번 (FastAPI 422 → 503이 되지 않게 여기서 400)
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		return ImportStatusResponseDTO.from(fastApiClient.startImport(sources, adminId));
	}

	@Override
	public ImportStatusResponseDTO getImport(Long jobId) {
		return ImportStatusResponseDTO.from(fastApiClient.getImport(jobId));
	}

	@Override
	public ImportStatusResponseDTO getLatestImport() {
		return ImportStatusResponseDTO.from(fastApiClient.getLatestImport());
	}

	@Override
	public PublishResponseDTO publishImport(Long adminId, Long jobId, PublishRequestDTO request) {
		// 기준 버전은 진행 확인 응답의 값 그대로 (DB에서 다시 읽지 않음: 비교 시점과 어긋나면 VERSION_CONFLICT를 못 잡음)
		List<Long> itemIds = request.getItemIds().stream().distinct().toList();
		FastApiVersionResponseDTO result = fastApiClient.publishImport(jobId, itemIds, request.getBaseVersion(), adminId);
		memoryCache.clearProductCaches();	// 성공 응답을 받은 뒤에만 (실패는 예외라 안 비움)
		return new PublishResponseDTO(result.getVersion());
	}
}
