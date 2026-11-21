package chorong.admin.service;

import chorong.admin.dto.ImportCheckResponseDTO;
import chorong.admin.dto.ImportRequestDTO;
import chorong.admin.dto.ImportStatusResponseDTO;
import chorong.admin.dto.PublishRequestDTO;
import chorong.admin.dto.PublishResponseDTO;

/*
 * FastAPI에 최신 확인, 갱신 시작, 진행 확인, 최근 작업, 반영 요청 (ADMIN-04) / 비교, 반영은 FastAPI (EXT-01, 02, 05)
 */
public interface AdminImportService {

	/** 최신 상품 확인: 출처 첫 쪽만 읽어 DB 적재 시각, 최신 여부 (적재 안 함). 출처 모두 실패, FastAPI 꺼짐은 503 */
	ImportCheckResponseDTO checkImport();

	/** 갱신 시작: 작업 번호만 바로 받음, 진행 중 작업이 있으면 409 */
	ImportStatusResponseDTO startImport(Long adminId, ImportRequestDTO request);

	/** 진행 상태, 기준 버전, 출처별 결과, 바뀐 상품 목록 */
	ImportStatusResponseDTO getImport(Long jobId);

	/** 가장 최근 작업 (getImport와 같은 응답, 없으면 404): 화면을 다시 열었을 때 진행 확인, 반영을 이어서 함 */
	ImportStatusResponseDTO getLatestImport();

	/** 고른 항목만 반영, 성공하면 상품 캐시 비움 */
	PublishResponseDTO publishImport(Long adminId, Long jobId, PublishRequestDTO request);
}
