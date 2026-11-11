package chorong.common.interceptor;

import java.time.LocalDateTime;

import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import chorong.admin.repository.AdminRepository;
import chorong.common.dto.LoginAdminDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.AdminUtil;
import chorong.common.util.LoginUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

/*
 * 관리자 확인 (B4, 등록 주소는 WebConfig)
 * 1. 관리자 세션 없음: 회원 세션이면 403, 아니면 401
 * 2. 로그인 시각 + 2시간 지나면 401 (활동해도 연장 없음)
 * 3. 요청마다 DB에서 상태 ACTIVE 다시 확인 (해제되면 바로 401)
 * 4. 승인권자 전용 주소(/api/admin/admins/**)는 DB 역할이 승인권자 아니면 403
 */
@Component
@RequiredArgsConstructor
public class AdminInterceptor implements HandlerInterceptor {

	private static final long LOGIN_HOURS = 2;
	private static final String APPROVER_ONLY_PATH = "/api/admin/admins";

	private final AdminRepository adminRepository;

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		// CORS 사전 확인 요청(OPTIONS)은 쿠키가 없으므로 그대로 통과
		if (CorsUtils.isPreFlightRequest(request)) return true;

		HttpSession session = request.getSession(false);
		LoginAdminDTO loginAdmin = AdminUtil.getLoginAdmin(session);

		// 1. 관리자 세션 없음
		if (loginAdmin == null) {
			if (LoginUtil.getLoginMember(session) != null) {
				throw new BusinessException(ErrorCode.FORBIDDEN);
			}
			throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
		}

		// 2. 로그인 2시간 지남
		if (loginAdmin.getLoginAt().plusHours(LOGIN_HOURS).isBefore(LocalDateTime.now())) {
			throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
		}

		// 3. DB 상태 다시 확인
		Admin admin = adminRepository.findById(loginAdmin.getAdminId()).orElse(null);
		if (admin == null || admin.getAdminStatus() != AdminStatus.ACTIVE) {
			throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
		}

		// 4. 승인권자 전용 주소
		if (isApproverOnly(request.getRequestURI()) && admin.getAdminRole() != AdminRole.APPROVER) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
		return true;
	}

	private boolean isApproverOnly(String uri) {
		return uri.equals(APPROVER_ONLY_PATH) || uri.startsWith(APPROVER_ONLY_PATH + "/");
	}
}
