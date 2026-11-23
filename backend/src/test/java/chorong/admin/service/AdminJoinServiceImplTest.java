package chorong.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpSession;

import chorong.admin.dto.AdminJoinRequestDTO;
import chorong.admin.dto.AdminJoinResponseDTO;
import chorong.admin.dto.AdminJoinTokenRequestDTO;
import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import chorong.admin.repository.AdminRepository;
import chorong.common.exception.BusinessException;
import chorong.common.util.AdminUtil;
import chorong.common.util.SessionConst;

/*
 * 관리자 가입 인증 토큰, 가입 신청 (ADMIN-07, B17)
 */
class AdminJoinServiceImplTest {

	private static final String EMAIL = "new@test.com";
	private static final String TOKEN = "123456";

	private AdminRepository adminRepository;
	private AdminAuthService adminAuthService;
	private AdminJoinServiceImpl service;

	@BeforeEach
	void setUp() {
		adminRepository = mock(AdminRepository.class);
		adminAuthService = mock(AdminAuthService.class);
		service = new AdminJoinServiceImpl(adminRepository, mock(AdminMailService.class), adminAuthService);
		when(adminRepository.findByAdminEmail(any())).thenReturn(Optional.empty());
		when(adminRepository.save(any(Admin.class))).thenAnswer(invocation -> invocation.getArgument(0));
	}

	@Test
	void 이미_정상인_이메일이면_409_등록된_메일() {
		// Given
		givenExisting(AdminStatus.ACTIVE);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.requestJoinToken(new MockHttpSession(), new AdminJoinTokenRequestDTO(EMAIL, "새관리자")));

		// Then
		assertEquals(AdminJoinServiceImpl.MSG_ALREADY_ACTIVE, e.getMessage());
	}

	@Test
	void 이미_신청한_이메일이면_409_이미_신청() {
		// Given
		givenExisting(AdminStatus.PENDING);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.requestJoinToken(new MockHttpSession(), new AdminJoinTokenRequestDTO(EMAIL, "새관리자")));

		// Then
		assertEquals(AdminJoinServiceImpl.MSG_ALREADY_PENDING, e.getMessage());
	}

	@Test
	void 인증_토큰이_10분_지나면_다시_받기() {
		// Given
		MockHttpSession session = joinSession(EMAIL, LocalDateTime.now().minusMinutes(11));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.join(session, new AdminJoinRequestDTO(EMAIL, "새관리자", TOKEN)));

		// Then
		assertEquals(AdminAuthServiceImpl.MSG_TOKEN_EXPIRED, e.getMessage());
	}

	@Test
	void 다른_이메일로_받은_토큰으로는_가입_못_함() {
		// Given: other@test.com으로 받은 토큰을 new@test.com 가입에 씀
		MockHttpSession session = joinSession("other@test.com", LocalDateTime.now());

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.join(session, new AdminJoinRequestDTO(EMAIL, "새관리자", TOKEN)));

		// Then
		assertEquals(AdminAuthServiceImpl.MSG_WRONG_TOKEN, e.getMessage());
	}

	@Test
	void 다섯번_틀리면_세션의_토큰_지움() {
		// Given
		MockHttpSession session = joinSession(EMAIL, LocalDateTime.now());
		session.setAttribute(SessionConst.ADMIN_JOIN_FAIL, 4);

		// When
		assertThrows(BusinessException.class,
				() -> service.join(session, new AdminJoinRequestDTO(EMAIL, "새관리자", "000000")));

		// Then
		assertNull(session.getAttribute(SessionConst.ADMIN_JOIN_HASH));
	}

	@Test
	void 정상_관리자가_0명이면_바로_정상() {
		// Given
		when(adminRepository.countByAdminStatus(AdminStatus.ACTIVE)).thenReturn(0L);

		// When
		AdminJoinResponseDTO result = service.join(joinSession(EMAIL, LocalDateTime.now()),
				new AdminJoinRequestDTO(EMAIL, "새관리자", TOKEN));

		// Then
		assertEquals(AdminStatus.ACTIVE, result.getAdminStatus());
	}

	@Test
	void 첫_가입자는_승인권자로_저장() {
		// Given
		when(adminRepository.countByAdminStatus(AdminStatus.ACTIVE)).thenReturn(0L);

		// When
		service.join(joinSession(EMAIL, LocalDateTime.now()), new AdminJoinRequestDTO(EMAIL, "새관리자", TOKEN));

		// Then
		ArgumentCaptor<Admin> saved = ArgumentCaptor.forClass(Admin.class);
		verify(adminRepository).save(saved.capture());
		assertEquals(AdminRole.APPROVER, saved.getValue().getAdminRole());
	}

	@Test
	void 정상_관리자가_있으면_승인_대기() {
		// Given
		when(adminRepository.countByAdminStatus(AdminStatus.ACTIVE)).thenReturn(1L);

		// When
		AdminJoinResponseDTO result = service.join(joinSession(EMAIL, LocalDateTime.now()),
				new AdminJoinRequestDTO(EMAIL, "새관리자", TOKEN));

		// Then
		assertEquals(AdminStatus.PENDING, result.getAdminStatus());
	}

	private void givenExisting(AdminStatus status) {
		Admin admin = Admin.builder().adminId(1L).adminEmail(EMAIL).adminStatus(status).failCount(0).build();
		when(adminRepository.findByAdminEmail(EMAIL)).thenReturn(Optional.of(admin));
	}

	// 가입 인증 토큰을 받은 세션 (해시는 이메일과 묶음)
	private MockHttpSession joinSession(String tokenEmail, LocalDateTime issuedAt) {
		MockHttpSession session = new MockHttpSession();
		session.setAttribute(SessionConst.ADMIN_JOIN_HASH, AdminUtil.sha256(tokenEmail + ":" + TOKEN));
		session.setAttribute(SessionConst.ADMIN_JOIN_AT, issuedAt);
		session.setAttribute(SessionConst.ADMIN_JOIN_FAIL, 0);
		return session;
	}
}
