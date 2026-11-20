package chorong.admin.service;

import chorong.admin.dto.AdminJoinRequestDTO;
import chorong.admin.dto.AdminJoinResponseDTO;
import chorong.admin.dto.AdminJoinTokenRequestDTO;
import jakarta.servlet.http.HttpSession;

/*
 * 관리자 가입 인증, 신청, 첫 관리자 승인권자 (ADMIN-07), 승인 대기 정리 (BAT-03)
 */
public interface AdminJoinService {

	/** 가입 인증 토큰: 이미 있는 이메일 409 (메일 안 보냄), 아니면 인증 메일을 보낸 뒤 세션에 해시 (이메일과 묶음) + 시각만 저장 */
	void requestJoinToken(HttpSession session, AdminJoinTokenRequestDTO request);

	/** 가입 신청: 세션 토큰 확인 → 정상 관리자 0명이면 ACTIVE + APPROVER + 바로 로그인, 아니면 PENDING */
	AdminJoinResponseDTO join(HttpSession session, AdminJoinRequestDTO request);

	/** 신청한 지 14일 지난 승인 대기 행 삭제, 지운 수 (BAT-03) */
	int cleanUpExpiredRequests();
}
