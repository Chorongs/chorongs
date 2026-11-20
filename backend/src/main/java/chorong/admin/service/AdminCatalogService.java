package chorong.admin.service;

import chorong.admin.dto.CatalogResponseDTO;
import chorong.admin.dto.HistoryResponseDTO;
import chorong.admin.dto.PublishResponseDTO;
import chorong.admin.dto.RollbackRequestDTO;
import chorong.admin.entity.ActionType;
import chorong.common.dto.PageInfo;

/*
 * 게시 상품 현황, 반영 이력, 되돌리기 (ADMIN-04, 05) / 되돌리기는 FastAPI에 요청
 */
public interface AdminCatalogService {

	/** 출처별 게시 상품 수, 현재 버전, 메뉴 옆 개수 (승인 대기 개수는 승인권자만, ADMIN-04) */
	CatalogResponseDTO getCatalog(Long adminId);

	/** 반영 이력 최신순 12건씩, actionType 없으면 전체 (ADMIN-05) */
	PageInfo<HistoryResponseDTO> getHistories(ActionType actionType, int page);

	/** 되돌리기: FastAPI가 한 트랜잭션으로 처리, 성공하면 상품 캐시 비움 (ADMIN-05) */
	PublishResponseDTO rollback(Long adminId, RollbackRequestDTO request);
}
