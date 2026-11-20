package chorong.admin.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.admin.dto.AdminJoinRequestDTO;
import chorong.admin.dto.AdminJoinResponseDTO;
import chorong.admin.dto.AdminJoinTokenRequestDTO;
import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import chorong.admin.repository.AdminRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.AdminUtil;
import chorong.common.util.SessionConst;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AdminJoinServiceImpl implements AdminJoinService {

	private static final long TOKEN_MINUTES = 10;	// 가입 인증 토큰 유효 시간
	private static final int MAX_FAIL = 5;			// 5번 틀리면 세션 값 지움
	private static final long PENDING_DAYS = 14;	// 승인 대기 보관 기간 (BAT-03)

	// 문구 (관리자 상세 기획 4-11 문구 2, 3, 9, 10)
	static final String MSG_ALREADY_ACTIVE = "이미 등록된 메일이에요. 로그인해 주세요";
	static final String MSG_ALREADY_PENDING = "이미 신청한 메일이에요. 승인되면 메일로 알려 드려요";

	private final AdminRepository adminRepository;
	private final AdminMailService adminMailService;
	private final AdminAuthService adminAuthService;	// 첫 가입자 바로 로그인 (로그인과 같은 세션 처리)

	@Override
	@Transactional(readOnly = true)
	public void requestJoinToken(HttpSession session, AdminJoinTokenRequestDTO request) {
		String email = AdminUtil.normalizeEmail(request.getEmail());
		checkNotRegistered(email);

		// 메일을 먼저 보내고, 보내진 뒤에만 세션에 저장 (이메일과 묶은 해시: 다른 이메일로는 못 씀)
		String token = AdminUtil.newToken();
		adminMailService.sendJoinToken(email, token);
		session.setAttribute(SessionConst.ADMIN_JOIN_HASH, AdminUtil.sha256(email + ":" + token));
		session.setAttribute(SessionConst.ADMIN_JOIN_AT, LocalDateTime.now());
		session.setAttribute(SessionConst.ADMIN_JOIN_FAIL, 0);
	}

	@Override
	@Transactional
	public AdminJoinResponseDTO join(HttpSession session, AdminJoinRequestDTO request) {
		LocalDateTime now = LocalDateTime.now();
		String email = AdminUtil.normalizeEmail(request.getEmail());

		// 1. 세션 토큰 비교 (10분, 5번 틀리면 세션 값 지움)
		checkJoinToken(session, email + ":" + request.getToken(), now);

		// 2~4. 첫 가입자 판단과 저장을 한 번에 (동시 가입 대비 admin 테이블 잠금, B16)
		adminRepository.lockTable();
		checkNotRegistered(email);
		clearJoinToken(session);

		if (adminRepository.countByAdminStatus(AdminStatus.ACTIVE) == 0) {
			Admin admin = adminRepository.save(request.toEntity(AdminRole.APPROVER, AdminStatus.ACTIVE, now));
			admin.succeedLogin(now);
			adminAuthService.startAdminSession(session, admin, now);
			return new AdminJoinResponseDTO(AdminStatus.ACTIVE);
		}
		adminRepository.save(request.toEntity(AdminRole.MANAGER, AdminStatus.PENDING, now));
		return new AdminJoinResponseDTO(AdminStatus.PENDING);
	}

	@Override
	@Transactional
	public int cleanUpExpiredRequests() {
		List<Admin> expired = adminRepository.findByAdminStatusAndRequestedAtBefore(
				AdminStatus.PENDING, LocalDateTime.now().minusDays(PENDING_DAYS));
		adminRepository.deleteAll(expired);
		return expired.size();
	}

	// 이미 있는 이메일이면 409 (정상: 등록된 메일 / 승인 대기: 이미 신청)
	private void checkNotRegistered(String email) {
		adminRepository.findByAdminEmail(email).ifPresent(admin -> {
			if (admin.getAdminStatus() == AdminStatus.PENDING) {
				throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_PENDING);
			}
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_ACTIVE);
		});
	}

	// 세션의 가입 인증 토큰 확인: 없거나 10분 지남 → 다시 받기 / 틀림 → 횟수 +1, 5번째면 지우고 다시 받기
	private void checkJoinToken(HttpSession session, String value, LocalDateTime now) {
		if (session == null
				|| !(session.getAttribute(SessionConst.ADMIN_JOIN_HASH) instanceof String hash)
				|| !(session.getAttribute(SessionConst.ADMIN_JOIN_AT) instanceof LocalDateTime issuedAt)) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, AdminAuthServiceImpl.MSG_TOKEN_EXPIRED);
		}
		if (issuedAt.plusMinutes(TOKEN_MINUTES).isBefore(now)) {
			clearJoinToken(session);
			throw new BusinessException(ErrorCode.INVALID_INPUT, AdminAuthServiceImpl.MSG_TOKEN_EXPIRED);
		}
		if (!AdminUtil.matchesHash(value, hash)) {
			int fail = (session.getAttribute(SessionConst.ADMIN_JOIN_FAIL) instanceof Integer count ? count : 0) + 1;
			if (fail >= MAX_FAIL) {
				clearJoinToken(session);
				throw new BusinessException(ErrorCode.INVALID_INPUT, AdminAuthServiceImpl.MSG_TOKEN_EXPIRED);
			}
			session.setAttribute(SessionConst.ADMIN_JOIN_FAIL, fail);
			throw new BusinessException(ErrorCode.INVALID_INPUT, AdminAuthServiceImpl.MSG_WRONG_TOKEN);
		}
	}

	private void clearJoinToken(HttpSession session) {
		session.removeAttribute(SessionConst.ADMIN_JOIN_HASH);
		session.removeAttribute(SessionConst.ADMIN_JOIN_AT);
		session.removeAttribute(SessionConst.ADMIN_JOIN_FAIL);
	}
}
