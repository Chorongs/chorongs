package chorong.admin.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import chorong.admin.entity.AdminRole;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * Gmail SMTP 메일 보내기 (EXT-06): 계정, 앱 비밀번호는 환경변수 MAIL_USERNAME, MAIL_PASSWORD (B12)
 * 본문은 문장마다 줄바꿈 / 보내기 실패 500 + 로그 (받는 사람, 토큰은 로그에 안 남김)
 */
@Service
public class AdminMailServiceImpl implements AdminMailService {

	private static final Logger log = LoggerFactory.getLogger(AdminMailServiceImpl.class);

	private final JavaMailSender sender;
	private final String frontUrl;

	public AdminMailServiceImpl(JavaMailSender sender, @Value("${front.url}") String frontUrl) {
		this.sender = sender;
		this.frontUrl = frontUrl;
	}

	@Override
	public void sendJoinToken(String email, String token) {
		String subject = "[캐링 관리자] 가입 인증 번호";
		String text = "인증 번호는 " + token + "입니다.\n"
				+ "10분 동안 유효합니다.\n"
				+ "본인이 신청하지 않았다면 이 메일은 무시해 주세요.";
		sendMail(subject, text, email, "가입 인증");
	}

	@Override
	public void sendApproved(String email, AdminRole adminRole) {
		String roleName = adminRole == AdminRole.APPROVER ? "승인권자" : "관리자";
		String subject = "[캐링 관리자] 가입이 승인되었습니다";
		String text = "관리자 가입이 승인되었습니다.\n"
				+ "역할은 " + roleName + "입니다.\n"
				+ "아래 주소에서 로그인해 주세요.\n"
				+ frontUrl + "/admin/login";
		sendMail(subject, text, email, "승인 안내");
	}

	@Override
	public void sendLoginToken(String email, String token) {
		String subject = "[캐링 관리자] 로그인 토큰";
		String text = "로그인 토큰은 " + token + "입니다.\n"
				+ "2시간 동안 유효하며 한 번만 사용할 수 있습니다.\n"
				+ "본인이 요청하지 않았다면 승인권자에게 알려 주세요.";
		sendMail(subject, text, email, "로그인 토큰");
	}

	// 메일 한 통 보내기 (실습 easymail-sender MailService.sendMail과 같은 방식)
	private void sendMail(String subject, String text, String to, String what) {
		SimpleMailMessage message = new SimpleMailMessage();
		message.setSubject(subject);
		message.setText(text);
		message.setTo(to);
		try {
			sender.send(message);
		} catch (MailException e) {
			log.warn("관리자 메일 보내기 실패: {} ({})", what, e.getClass().getSimpleName());
			throw new BusinessException(ErrorCode.SERVER_ERROR);
		}
	}
}
