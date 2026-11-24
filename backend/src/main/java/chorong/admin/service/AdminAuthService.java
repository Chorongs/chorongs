package chorong.admin.service;

import java.time.LocalDateTime;

import chorong.admin.dto.AdminLoginRequestDTO;
import chorong.admin.dto.AdminResponseDTO;
import chorong.admin.dto.AdminTokenRequestDTO;
import chorong.admin.entity.Admin;
import jakarta.servlet.http.HttpSession;

/*
 * 관리자 토큰 발급, 확인, 잠금, 세션 (ADMIN-02, 03)
 */
public interface AdminAuthService {

	/** 정상 관리자에게만 로그인 토큰 메일, 등록 안 됨 404 / 승인 대기 403 / 잠김 423 (ADMIN-02) */
	void requestToken(AdminTokenRequestDTO request);

	/** 토큰 로그인: 틀리면 실패 +1, 5번째면 30분 잠금 423 / 맞으면 세션에 관리자 저장 (세션 번호 새로 발급은 Controller, ADMIN-03) */
	AdminResponseDTO login(HttpSession session, AdminLoginRequestDTO request);

	/** 세션 확인: 2시간 지남, 정상 관리자 아님이면 세션 끊고 401 (ADMIN-03 GET) */
	AdminResponseDTO getSession(HttpSession session);

	/** 세션 무효화, 세션이 없어도 오류 없음 (ADMIN-03 DELETE) */
	void logout(HttpSession session);

	/** 관리자 로그인 상태로 만들기: 회원 로그인 정보 삭제 (한 세션 한 역할) + 세션에 관리자 저장 (로그인, 첫 가입자 ADMIN-07) */
	AdminResponseDTO startAdminSession(HttpSession session, Admin admin, LocalDateTime now);
}
