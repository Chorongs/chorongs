package chorong.common.interceptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import chorong.admin.repository.AdminRepository;
import chorong.common.dto.LoginAdminDTO;
import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.SessionConst;

/*
 * AdminInterceptor 공격 요청 테스트 (B4)
 * DB 대신 Mockito 가짜 AdminRepository를 씀
 */
class AdminInterceptorTest {

	private static final Long ADMIN_ID = 1L;

	private AdminRepository adminRepository;
	private AdminInterceptor adminInterceptor;
	private MockHttpServletResponse response;

	@BeforeEach
	void setUp() {
		adminRepository = mock(AdminRepository.class);
		adminInterceptor = new AdminInterceptor(adminRepository);
		response = new MockHttpServletResponse();
	}

	@Test
	void 세션이_없으면_401() {
		// Given
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/products");

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> adminInterceptor.preHandle(request, response, null));

		// Then
		assertEquals(ErrorCode.LOGIN_REQUIRED, e.getErrorCode());
	}

	@Test
	void 회원_세션으로_접근하면_403() {
		// Given
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/admin/products");
		request.getSession().setAttribute(SessionConst.LOGIN_MEMBER,
				new LoginMemberDTO(10L, "회원", "2000", "01-01"));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> adminInterceptor.preHandle(request, response, null));

		// Then
		assertEquals(ErrorCode.FORBIDDEN, e.getErrorCode());
	}

	@Test
	void 로그인_2시간이_지나면_401() {
		// Given
		MockHttpServletRequest request = adminRequest("/api/admin/products", LocalDateTime.now().minusHours(2).minusMinutes(1));
		givenAdmin(AdminStatus.ACTIVE, AdminRole.APPROVER);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> adminInterceptor.preHandle(request, response, null));

		// Then
		assertEquals(ErrorCode.LOGIN_REQUIRED, e.getErrorCode());
	}

	@Test
	void 해제된_관리자는_401() {
		// Given
		MockHttpServletRequest request = adminRequest("/api/admin/products", LocalDateTime.now());
		givenAdmin(AdminStatus.REMOVED, AdminRole.MANAGER);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> adminInterceptor.preHandle(request, response, null));

		// Then
		assertEquals(ErrorCode.LOGIN_REQUIRED, e.getErrorCode());
	}

	@Test
	void 관리자가_승인권자_전용_주소를_부르면_403() {
		// Given
		MockHttpServletRequest request = adminRequest("/api/admin/admins/2/approve", LocalDateTime.now());
		givenAdmin(AdminStatus.ACTIVE, AdminRole.MANAGER);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> adminInterceptor.preHandle(request, response, null));

		// Then
		assertEquals(ErrorCode.FORBIDDEN, e.getErrorCode());
	}

	@Test
	void 승인권자는_승인권자_전용_주소를_통과() {
		// Given
		MockHttpServletRequest request = adminRequest("/api/admin/admins", LocalDateTime.now());
		givenAdmin(AdminStatus.ACTIVE, AdminRole.APPROVER);

		// When
		boolean result = adminInterceptor.preHandle(request, response, null);

		// Then
		assertTrue(result);
	}

	// 관리자 세션이 있는 요청 (세션 역할은 승인권자로 두고, DB 역할로 판단하는지 확인)
	private MockHttpServletRequest adminRequest(String uri, LocalDateTime loginAt) {
		MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
		request.getSession().setAttribute(SessionConst.LOGIN_ADMIN,
				new LoginAdminDTO(ADMIN_ID, "관리자", AdminRole.APPROVER, loginAt));
		return request;
	}

	// DB에 있는 관리자 (가짜)
	private void givenAdmin(AdminStatus status, AdminRole role) {
		Admin admin = mock(Admin.class);
		when(admin.getAdminStatus()).thenReturn(status);
		when(admin.getAdminRole()).thenReturn(role);
		when(adminRepository.findById(ADMIN_ID)).thenReturn(Optional.of(admin));
	}
}
