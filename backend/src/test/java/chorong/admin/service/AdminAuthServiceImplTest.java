package chorong.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpSession;

import chorong.admin.dto.AdminLoginRequestDTO;
import chorong.admin.dto.AdminTokenRequestDTO;
import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import chorong.admin.entity.AdminToken;
import chorong.admin.repository.AdminRepository;
import chorong.admin.repository.AdminTokenRepository;
import chorong.common.dto.LoginAdminDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.AdminUtil;
import chorong.common.util.SessionConst;
import chorong.member.service.AuthService;

/*
 * 관리자 토큰 요청, 로그인, 세션 확인 (B17 토큰, B4 권한)
 * DB, 메일 대신 Mockito 가짜 객체를 씀
 */
class AdminAuthServiceImplTest {

	private static final Long ADMIN_ID = 1L;
	private static final String EMAIL = "admin@test.com";
	private static final String TOKEN = "123456";

	private AdminRepository adminRepository;
	private AdminTokenRepository adminTokenRepository;
	private AdminMailService adminMailService;
	private AuthService authService;
	private AdminAuthServiceImpl service;

	@BeforeEach
	void setUp() {
		adminRepository = mock(AdminRepository.class);
		adminTokenRepository = mock(AdminTokenRepository.class);
		adminMailService = mock(AdminMailService.class);
		authService = mock(AuthService.class);
		service = new AdminAuthServiceImpl(adminRepository, adminTokenRepository, adminMailService, authService);
	}

	// ---- 토큰 요청 (ADMIN-02) ----

	@Test
	void 등록되지_않은_이메일이면_404() {
		// Given
		when(adminRepository.findByAdminEmail(EMAIL)).thenReturn(Optional.empty());

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.requestToken(new AdminTokenRequestDTO(EMAIL)));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 승인_대기면_403() {
		// Given
		givenAdmin(admin(AdminStatus.PENDING, 0, null));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.requestToken(new AdminTokenRequestDTO(EMAIL)));

		// Then
		assertEquals(ErrorCode.FORBIDDEN, e.getErrorCode());
	}

	@Test
	void 잠겨_있으면_423() {
		// Given
		givenAdmin(admin(AdminStatus.ACTIVE, 5, LocalDateTime.now().plusMinutes(10)));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.requestToken(new AdminTokenRequestDTO(EMAIL)));

		// Then
		assertEquals(ErrorCode.ADMIN_LOCKED, e.getErrorCode());
	}

	@Test
	void 정상_관리자가_아니면_메일을_보내지_않음() {
		// Given
		givenAdmin(admin(AdminStatus.PENDING, 0, null));

		// When
		assertThrows(BusinessException.class, () -> service.requestToken(new AdminTokenRequestDTO(EMAIL)));

		// Then
		verify(adminMailService, never()).sendLoginToken(anyString(), anyString());
	}

	@Test
	void 토큰은_원문이_아니라_해시만_저장() {
		// Given
		givenAdmin(admin(AdminStatus.ACTIVE, 0, null));

		// When
		service.requestToken(new AdminTokenRequestDTO(EMAIL));

		// Then: 메일로 보낸 원문의 해시가 DB에 저장된 값
		ArgumentCaptor<String> mailed = ArgumentCaptor.forClass(String.class);
		verify(adminMailService).sendLoginToken(eq(EMAIL), mailed.capture());
		ArgumentCaptor<AdminToken> saved = ArgumentCaptor.forClass(AdminToken.class);
		verify(adminTokenRepository).save(saved.capture());
		assertEquals(AdminUtil.sha256(mailed.getValue()), saved.getValue().getTokenHash());
	}

	// ---- 토큰 로그인 (ADMIN-03) ----

	@Test
	void 토큰이_틀리면_실패_횟수_더하기() {
		// Given
		Admin admin = admin(AdminStatus.ACTIVE, 0, null);
		givenAdmin(admin);
		givenToken(LocalDateTime.now());

		// When
		assertThrows(BusinessException.class,
				() -> service.login(new MockHttpSession(), new AdminLoginRequestDTO(EMAIL, "000000")));

		// Then
		assertEquals(1, admin.getFailCount());
	}

	@Test
	void 다섯번째로_틀리면_423() {
		// Given
		givenAdmin(admin(AdminStatus.ACTIVE, 4, null));
		givenToken(LocalDateTime.now());

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.login(new MockHttpSession(), new AdminLoginRequestDTO(EMAIL, "000000")));

		// Then
		assertEquals(ErrorCode.ADMIN_LOCKED, e.getErrorCode());
	}

	@Test
	void 발급하고_2시간_지난_토큰은_다시_받기() {
		// Given
		givenAdmin(admin(AdminStatus.ACTIVE, 0, null));
		givenToken(LocalDateTime.now().minusHours(2).minusMinutes(1));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.login(new MockHttpSession(), new AdminLoginRequestDTO(EMAIL, TOKEN)));

		// Then
		assertEquals(AdminAuthServiceImpl.MSG_TOKEN_EXPIRED, e.getMessage());
	}

	@Test
	void 토큰이_맞으면_세션에_관리자_저장() {
		// Given
		givenAdmin(admin(AdminStatus.ACTIVE, 0, null));
		givenToken(LocalDateTime.now());
		MockHttpSession session = new MockHttpSession();

		// When
		service.login(session, new AdminLoginRequestDTO(EMAIL, TOKEN));

		// Then
		assertNotNull(session.getAttribute(SessionConst.LOGIN_ADMIN));
	}

	@Test
	void 관리자로_로그인하면_회원_로그인_정보_삭제() {
		// Given
		givenAdmin(admin(AdminStatus.ACTIVE, 0, null));
		givenToken(LocalDateTime.now());
		MockHttpSession session = new MockHttpSession();

		// When
		service.login(session, new AdminLoginRequestDTO(EMAIL, TOKEN));

		// Then
		verify(authService).logout(session);
	}

	// ---- 세션 확인 (ADMIN-03 GET) ----

	@Test
	void 로그인_2시간이_지나면_세션_끊고_401() {
		// Given
		MockHttpSession session = adminSession(LocalDateTime.now().minusHours(2).minusMinutes(1));

		// When
		assertThrows(BusinessException.class, () -> service.getSession(session));

		// Then
		assertTrue(session.isInvalid());
	}

	@Test
	void 해제된_관리자는_권한이_없어졌어요_401() {
		// Given
		MockHttpSession session = adminSession(LocalDateTime.now());
		when(adminRepository.findById(ADMIN_ID)).thenReturn(Optional.of(admin(AdminStatus.REMOVED, 0, null)));

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> service.getSession(session));

		// Then
		assertEquals(AdminAuthServiceImpl.MSG_NO_PERMISSION, e.getMessage());
	}

	@Test
	void 관리자_세션이_없으면_401() {
		// Given
		MockHttpSession session = new MockHttpSession();

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> service.getSession(session));

		// Then
		assertEquals(ErrorCode.LOGIN_REQUIRED, e.getErrorCode());
	}

	private Admin admin(AdminStatus status, int failCount, LocalDateTime lockedUntil) {
		return Admin.builder().adminId(ADMIN_ID).adminEmail(EMAIL).adminName("관리자")
				.adminRole(AdminRole.APPROVER).adminStatus(status)
				.failCount(failCount).lockedUntil(lockedUntil).build();
	}

	private void givenAdmin(Admin admin) {
		when(adminRepository.findByAdminEmail(EMAIL)).thenReturn(Optional.of(admin));
	}

	private void givenToken(LocalDateTime issuedAt) {
		AdminToken token = AdminToken.builder().tokenId(10L).adminId(ADMIN_ID)
				.tokenHash(AdminUtil.sha256(TOKEN)).usedYn("N").tokenHistory(issuedAt).build();
		when(adminTokenRepository.findTopByAdminIdAndUsedYnOrderByTokenIdDesc(eq(ADMIN_ID), any()))
				.thenReturn(Optional.of(token));
	}

	private MockHttpSession adminSession(LocalDateTime loginAt) {
		MockHttpSession session = new MockHttpSession();
		session.setAttribute(SessionConst.LOGIN_ADMIN, new LoginAdminDTO(ADMIN_ID, "관리자", AdminRole.APPROVER, loginAt));
		return session;
	}
}
