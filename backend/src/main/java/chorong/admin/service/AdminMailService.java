package chorong.admin.service;

import chorong.admin.entity.AdminRole;

/*
 * 관리자 메일 (EXT-06): 가입 인증, 승인 안내, 로그인 토큰 / HTML 템플릿 1개 (templates/mail/admin-mail.html), 거절은 메일 없음
 * 토큰 메일 2개는 @Async: 부르는 쪽은 바로 204, 메일은 다른 스레드에서 (Gmail SMTP 3~10초를 화면이 기다리지 않게). 실패는 로그만
 * 승인 안내는 그대로 같은 요청 안에서 (실패하면 500 + 승인 되돌림, ADMIN-08)
 */
public interface AdminMailService {

	/** 가입 인증 번호 메일 (ADMIN-07). 응답 뒤 보냄 (@Async), 실패는 로그만 */
	void sendJoinToken(String email, String token);

	/** 가입 승인 안내 메일 (ADMIN-08). 같은 요청 안에서 보내고 실패하면 500 */
	void sendApproved(String email, AdminRole adminRole);

	/** 로그인 토큰 메일 (ADMIN-02). 응답 뒤 보냄 (@Async), 실패는 로그만 */
	void sendLoginToken(String email, String token);
}
