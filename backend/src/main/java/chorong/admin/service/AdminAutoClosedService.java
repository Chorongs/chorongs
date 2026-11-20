package chorong.admin.service;

import chorong.admin.dto.AutoClosedHandleRequestDTO;
import chorong.admin.dto.AutoClosedResponseDTO;
import chorong.common.dto.PageInfo;

/*
 * 자동 내림 (BAT-02), 확인, 다시 게시 (ADMIN-10)
 */
public interface AdminAutoClosedService {

	/** 자동 내림 목록 20건씩: filter UNCHECKED(없으면 기본) 확인 전, KEEP 확인함, REOPEN 다시 게시함 */
	PageInfo<AutoClosedResponseDTO> getAutoClosed(String filter, int page);

	/** 확인(KEEP) 또는 다시 게시(REOPEN), 이미 처리한 항목이 섞이면 409 */
	void handleAutoClosed(Long adminId, AutoClosedHandleRequestDTO request);

	/** 공시 종료일이 지난 게시 상품을 판매 종료로, 내린 수 (BAT-02 매일 06:00) */
	int closeExpiredProducts();
}
