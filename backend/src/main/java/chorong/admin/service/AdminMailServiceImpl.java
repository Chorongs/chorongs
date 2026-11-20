package chorong.admin.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import chorong.admin.entity.AdminRole;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

/*
 * Gmail SMTP 메일 보내기 (EXT-06): 계정, 앱 비밀번호는 환경변수 MAIL_USERNAME, MAIL_PASSWORD (B12)
 * 본문은 HTML 템플릿 1개 (templates/mail/admin-mail.html)에 메일마다 다른 문구, 번호를 넣어 만듦 + 로고는 메일에 붙인 그림 (cid:logo)
 * 보내기 실패 500 + 로그 (받는 사람, 토큰은 로그에 안 남김)
 */
@Service
public class AdminMailServiceImpl implements AdminMailService {

	private static final Logger log = LoggerFactory.getLogger(AdminMailServiceImpl.class);

	private static final String TEMPLATE = "mail/admin-mail";	// resources/templates/mail/admin-mail.html
	private static final String LOGO = "mail/logo.png";			// resources/mail/logo.png (프론트 logo_main.png 복사본)
	private static final String LOGIN_PATH = "/admin/login";

	private final JavaMailSender sender;
	private final SpringTemplateEngine templateEngine;
	private final String frontUrl;

	public AdminMailServiceImpl(JavaMailSender sender, SpringTemplateEngine templateEngine,
			@Value("${front.url}") String frontUrl) {
		this.sender = sender;
		this.templateEngine = templateEngine;
		this.frontUrl = frontUrl;
	}

	@Override
	public void sendJoinToken(String email, String token) {
		String subject = "[캐링 관리자] 가입 인증 번호";
		Context context = newContext(subject, List.of("관리자 가입 신청을 위한", "인증 번호를 보내 드립니다."),
				"10분 동안 유효합니다.", "본인이 신청하지 않았다면 이 메일은 무시해 주세요.");
		setCode(context, "인증 번호", token);	// 버튼 없음: 가입 화면에 바로 입력
		sendMail(subject, context, email, "가입 인증");
	}

	@Override
	public void sendApproved(String email, AdminRole adminRole) {
		String roleName = adminRole == AdminRole.APPROVER ? "승인권자" : "관리자";
		String subject = "[캐링 관리자] 가입이 승인되었습니다";
		Context context = newContext(subject, List.of("관리자 가입이 승인되었습니다."),
				"역할은 " + roleName + "입니다. 아래 버튼에서 로그인해 주세요.", null);	// 번호 칸, 노란 안내 없음
		context.setVariable("loginUrl", frontUrl + LOGIN_PATH);
		sendMail(subject, context, email, "승인 안내");
	}

	@Override
	public void sendLoginToken(String email, String token) {
		String subject = "[캐링 관리자] 로그인 토큰";
		Context context = newContext(subject, List.of("관리자 페이지 로그인을 위한", "로그인 토큰을 보내 드립니다."),
				"2시간 동안 유효하며 한 번만 사용할 수 있습니다.", "본인이 요청하지 않았다면 승인권자에게 알려 주세요.");
		setCode(context, "로그인 토큰", token);
		context.setVariable("loginUrl", frontUrl + LOGIN_PATH);
		sendMail(subject, context, email, "로그인 토큰");
	}

	// 템플릿 칸 값 (메일마다 다른 문구): 제목, 첫 문장 줄들, 굵은 안내, 노란 안내 (null이면 칸이 숨겨짐)
	private static Context newContext(String subject, List<String> introLines, String notice, String warning) {
		Context context = new Context();
		context.setVariable("subject", subject);
		context.setVariable("introLines", introLines);
		context.setVariable("notice", notice);
		context.setVariable("warning", warning);
		return context;
	}

	// 번호 칸: 이름 + 6자리를 한 칸에 한 글자씩
	private static void setCode(Context context, String label, String token) {
		context.setVariable("codeLabel", label);
		context.setVariable("codeDigits", List.of(token.split("")));
	}

	// 메일 한 통 보내기: 템플릿으로 HTML을 만들고, 로고 그림을 붙여 보냄
	private void sendMail(String subject, Context context, String to, String what) {
		String html = templateEngine.process(TEMPLATE, context);
		try {
			MimeMessage message = sender.createMimeMessage();
			MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");	// true = 여러 부분 (HTML 본문 + 로고 그림)
			helper.setSubject(subject);
			helper.setTo(to);
			helper.setText(html, true);											// true = HTML
			helper.addInline("logo", new ClassPathResource(LOGO));				// 템플릿의 cid:logo (본문을 넣은 뒤에 붙여야 함)
			sender.send(message);
		} catch (MessagingException | MailException e) {
			log.warn("관리자 메일 보내기 실패: {} ({})", what, e.getClass().getSimpleName());
			throw new BusinessException(ErrorCode.SERVER_ERROR);
		}
	}
}
