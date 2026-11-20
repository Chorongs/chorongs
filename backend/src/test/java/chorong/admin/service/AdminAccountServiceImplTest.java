package chorong.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;

import chorong.admin.dto.AdminRemoveRequestDTO;
import chorong.admin.dto.AdminRoleRequestDTO;
import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import chorong.admin.repository.AdminRepository;
import chorong.admin.repository.AdminTokenRepository;
import chorong.common.dto.LoginAdminDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.SessionConst;

/*
 * 승인, 역할, 거절, 해제, 탈퇴 (ADMIN-08, 09) / 마지막 정상 승인권자 보호
 */
class AdminAccountServiceImplTest {

	private static final Long MY_ID = 1L;
	private static final Long OTHER_ID = 2L;
	private static final String MY_EMAIL = "me@test.com";

	private AdminRepository adminRepository;
	private AdminTokenRepository adminTokenRepository;
	private AdminAccountServiceImpl service;

	@BeforeEach
	void setUp() {
		adminRepository = mock(AdminRepository.class);
		adminTokenRepository = mock(AdminTokenRepository.class);
		service = new AdminAccountServiceImpl(adminRepository, adminTokenRepository, mock(AdminMailService.class));
	}

	@Test
	void 마지막_승인권자는_탈퇴하면_409() {
		// Given
		givenAdmin(MY_ID, AdminStatus.ACTIVE, AdminRole.APPROVER);
		givenActiveApprovers(1);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.withdraw(mySession(), new AdminRemoveRequestDTO(MY_EMAIL)));

		// Then
		assertEquals(AdminAccountServiceImpl.MSG_LAST_APPROVER, e.getMessage());
	}

	@Test
	void 마지막_승인권자를_관리자로_내리면_409() {
		// Given
		givenAdmin(OTHER_ID, AdminStatus.ACTIVE, AdminRole.APPROVER);
		givenActiveApprovers(1);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.changeRole(OTHER_ID, new AdminRoleRequestDTO(AdminRole.MANAGER)));

		// Then
		assertEquals(AdminAccountServiceImpl.MSG_LAST_APPROVER, e.getMessage());
	}

	@Test
	void 승인권자가_2명이면_역할_내리기_가능() {
		// Given
		Admin admin = givenAdmin(OTHER_ID, AdminStatus.ACTIVE, AdminRole.APPROVER);
		givenActiveApprovers(2);

		// When
		service.changeRole(OTHER_ID, new AdminRoleRequestDTO(AdminRole.MANAGER));

		// Then
		assertEquals(AdminRole.MANAGER, admin.getAdminRole());
	}

	@Test
	void 이미_처리된_신청을_승인하면_409() {
		// Given
		givenAdmin(OTHER_ID, AdminStatus.ACTIVE, AdminRole.MANAGER);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.approveAdmin(MY_ID, OTHER_ID, new AdminRoleRequestDTO(AdminRole.MANAGER)));

		// Then
		assertEquals(AdminAccountServiceImpl.MSG_ALREADY_HANDLED, e.getMessage());
	}

	@Test
	void 승인_대기를_거절하면_행_삭제() {
		// Given
		Admin admin = givenAdmin(OTHER_ID, AdminStatus.PENDING, AdminRole.MANAGER);

		// When
		service.removeAdmin(OTHER_ID);

		// Then
		verify(adminRepository).delete(admin);
	}

	@Test
	void 이미_탈퇴한_관리자를_해제하면_404() {
		// Given
		givenAdmin(OTHER_ID, AdminStatus.REMOVED, AdminRole.MANAGER);

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> service.removeAdmin(OTHER_ID));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 탈퇴하면_이메일_비움() {
		// Given
		Admin admin = givenAdmin(MY_ID, AdminStatus.ACTIVE, AdminRole.MANAGER);

		// When
		service.withdraw(mySession(), new AdminRemoveRequestDTO(MY_EMAIL));

		// Then
		assertNull(admin.getAdminEmail());
	}

	@Test
	void 탈퇴하면_안_쓴_토큰_무효() {
		// Given
		givenAdmin(MY_ID, AdminStatus.ACTIVE, AdminRole.MANAGER);

		// When
		service.withdraw(mySession(), new AdminRemoveRequestDTO(MY_EMAIL));

		// Then
		verify(adminTokenRepository).expireUnusedTokens(MY_ID);
	}

	@Test
	void 탈퇴하면_세션_무효화() {
		// Given
		givenAdmin(MY_ID, AdminStatus.ACTIVE, AdminRole.MANAGER);
		MockHttpSession session = mySession();

		// When
		service.withdraw(session, new AdminRemoveRequestDTO(MY_EMAIL));

		// Then
		assertTrue(session.isInvalid());
	}

	@Test
	void 확인_이메일이_내_이메일과_다르면_400() {
		// Given
		givenAdmin(MY_ID, AdminStatus.ACTIVE, AdminRole.MANAGER);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.withdraw(mySession(), new AdminRemoveRequestDTO("other@test.com")));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 탈퇴한_관리자_목록을_요청하면_400() {
		// Given, When
		BusinessException e = assertThrows(BusinessException.class, () -> service.getAdmins(AdminStatus.REMOVED));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	private Admin givenAdmin(Long adminId, AdminStatus status, AdminRole role) {
		Admin admin = Admin.builder().adminId(adminId).adminEmail(adminId.equals(MY_ID) ? MY_EMAIL : "other@test.com")
				.adminName("관리자").adminRole(role).adminStatus(status).failCount(0).build();
		when(adminRepository.findById(adminId)).thenReturn(Optional.of(admin));
		return admin;
	}

	private void givenActiveApprovers(long count) {
		when(adminRepository.countByAdminStatusAndAdminRole(AdminStatus.ACTIVE, AdminRole.APPROVER)).thenReturn(count);
	}

	private MockHttpSession mySession() {
		MockHttpSession session = new MockHttpSession();
		session.setAttribute(SessionConst.LOGIN_ADMIN, new LoginAdminDTO(MY_ID, "관리자", AdminRole.MANAGER, LocalDateTime.now()));
		return session;
	}
}
