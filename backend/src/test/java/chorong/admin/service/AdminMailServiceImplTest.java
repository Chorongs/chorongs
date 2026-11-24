package chorong.admin.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Properties;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import chorong.admin.entity.AdminRole;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import jakarta.mail.BodyPart;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeMultipart;

/*
 * 관리자 메일 (EXT-06): 템플릿 1개에 메일마다 다른 값이 들어가는지
 * 템플릿 엔진은 진짜 (Spring Boot 기본과 같은 설정: templates/ + .html), 메일 서버는 Mockito 가짜
 */
class AdminMailServiceImplTest {

	private static final String FRONT_URL = "http://front.test";
	private static final String EMAIL = "admin@test.com";

	private JavaMailSender sender;
	private AdminMailServiceImpl service;

	@BeforeEach
	void setUp() {
		ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
		resolver.setPrefix("templates/");
		resolver.setSuffix(".html");
		resolver.setTemplateMode(TemplateMode.HTML);
		resolver.setCharacterEncoding("UTF-8");
		SpringTemplateEngine templateEngine = new SpringTemplateEngine();
		templateEngine.setTemplateResolver(resolver);

		sender = mock(JavaMailSender.class);
		when(sender.createMimeMessage()).thenReturn(new MimeMessage(Session.getInstance(new Properties())));
		service = new AdminMailServiceImpl(sender, templateEngine, FRONT_URL);
	}

	@Test
	void 로그인_토큰_메일에는_토큰_6자리가_들어감() throws Exception {
		// Given, When
		service.sendLoginToken(EMAIL, "135790");

		// Then: 태그를 빼면 한 칸에 한 글자씩 넣은 6자리가 이어짐
		assertTrue(htmlOf(sentMessage()).replaceAll("<[^>]+>", "").contains("135790"));
	}

	@Test
	void 로그인_토큰_메일_버튼은_관리자_로그인_주소() throws Exception {
		// Given, When
		service.sendLoginToken(EMAIL, "135790");

		// Then
		assertTrue(htmlOf(sentMessage()).contains("href=\"" + FRONT_URL + "/admin/login\""));
	}

	@Test
	void 승인_안내_메일에는_번호_칸이_없음() throws Exception {
		// Given, When
		service.sendApproved(EMAIL, AdminRole.MANAGER);

		// Then: 번호 칸만 쓰는 스타일이 없음
		assertFalse(htmlOf(sentMessage()).contains("user-select:all"));
	}

	@Test
	void 로고는_cid_logo로_붙음() throws Exception {
		// Given, When
		service.sendJoinToken(EMAIL, "135790");

		// Then
		assertTrue(hasPart(sentMessage().getContent(), "<logo>"));
	}

	@Test
	void 승인_안내_메일_보내기에_실패하면_500() {
		// Given
		doThrow(new MailSendException("실패")).when(sender).send(any(MimeMessage.class));

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> service.sendApproved(EMAIL, AdminRole.MANAGER));

		// Then
		assertEquals(ErrorCode.SERVER_ERROR, e.getErrorCode());
	}

	@Test
	void 로그인_토큰_메일은_응답_뒤에_보내므로_실패해도_예외_없음() {
		// Given
		doThrow(new MailSendException("실패")).when(sender).send(any(MimeMessage.class));

		// When, Then
		assertDoesNotThrow(() -> service.sendLoginToken(EMAIL, "135790"));
	}

	// 보낸 메일 (머리글을 채워야 부분마다 종류를 알 수 있음)
	private MimeMessage sentMessage() throws Exception {
		ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
		verify(sender).send(captor.capture());
		MimeMessage message = captor.getValue();
		message.saveChanges();
		return message;
	}

	// 여러 부분 중 HTML 본문
	private String htmlOf(MimeMessage message) throws Exception {
		return findHtml(message.getContent());
	}

	private String findHtml(Object content) throws Exception {
		if (content instanceof MimeMultipart multipart) {
			for (int i = 0; i < multipart.getCount(); i++) {
				BodyPart part = multipart.getBodyPart(i);
				String html = part.isMimeType("text/html") ? (String) part.getContent() : findHtml(part.getContent());
				if (html != null) {
					return html;
				}
			}
		}
		return null;
	}

	// 붙인 부분 중 Content-ID가 같은 것이 있는지
	private boolean hasPart(Object content, String contentId) throws Exception {
		if (content instanceof MimeMultipart multipart) {
			for (int i = 0; i < multipart.getCount(); i++) {
				BodyPart part = multipart.getBodyPart(i);
				String[] ids = part.getHeader("Content-ID");
				if ((ids != null && contentId.equals(ids[0])) || hasPart(part.getContent(), contentId)) {
					return true;
				}
			}
		}
		return false;
	}
}
