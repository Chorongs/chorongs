package chorong.admin.service;

import chorong.admin.entity.AdminRole;

/*
 * 관리자 메일 (EXT-06): 가입 인증, 승인 안내, 로그인 토큰 / 글자만 (SimpleMailMessage), 거절은 메일 없음
 */
public interface AdminMailService {

	/** 가입 인증 번호 메일 (ADMIN-07) */
	void sendJoinToken(String email, String token);

	/** 가입 승인 안내 메일 (ADMIN-08) */
	void sendApproved(String email, AdminRole adminRole);

	/** 로그인 토큰 메일 (ADMIN-02) */
	void sendLoginToken(String email, String token);
}
