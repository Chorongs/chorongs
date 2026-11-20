package chorong.admin.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.admin.dto.AdminLoginRequestDTO;
import chorong.admin.dto.AdminResponseDTO;
import chorong.admin.dto.AdminTokenRequestDTO;
import chorong.admin.entity.Admin;
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
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AdminAuthServiceImpl implements AdminAuthService {

	private static final long TOKEN_HOURS = 2;		// 로그인 토큰 유효 시간 (B17)

	// 문구 (관리자 상세 기획 4-11)
	static final String MSG_NOT_REGISTERED = "등록되지 않은 메일이에요. 다시 확인해 주세요";
	static final String MSG_PENDING = "승인 대기 중인 메일이에요. 승인되면 메일로 알려 드려요";
	static final String MSG_LOCKED = "5번 틀려서 잠겼어요. 30분 뒤 다시 시도하세요";
	static final String MSG_WRONG_TOKEN = "토큰이 맞지 않아요";
	static final String MSG_TOKEN_EXPIRED = "토큰을 다시 받아 주세요";

	private final AdminRepository adminRepository;
	private final AdminTokenRepository adminTokenRepository;
	private final AdminMailService adminMailService;
	private final AuthService authService;	// 회원 로그아웃 (회원 로그인 정보만 삭제, MEM-02)을 그대로 씀

	@Override
	@Transactional
	public void requestToken(AdminTokenRequestDTO request) {
		LocalDateTime now = LocalDateTime.now();
		Admin admin = findLoginableAdmin(request.getEmail(), now);

		// 이전에 받은 안 쓴 토큰 무효 → 새 토큰은 해시만 저장 → 원문은 메일로만
		adminTokenRepository.expireUnusedTokens(admin.getAdminId());
		String token = AdminUtil.newToken();
		adminTokenRepository.save(AdminToken.builder()
				.adminId(admin.getAdminId())
				.tokenHash(AdminUtil.sha256(token))
				.usedYn("N")
				.tokenHistory(now)
				.build());
		adminMailService.sendLoginToken(admin.getAdminEmail(), token);
	}

	// 틀린 횟수, 잠금은 오류 응답을 보내도 저장돼야 해서 BusinessException에는 되돌리지 않음
	@Override
	@Transactional(noRollbackFor = BusinessException.class)
	public AdminResponseDTO login(HttpSession session, AdminLoginRequestDTO request) {
		LocalDateTime now = LocalDateTime.now();
		Admin admin = findLoginableAdmin(request.getEmail(), now);

		// 1. 최신 안 쓴 토큰: 없거나 발급 + 2시간 지났으면 다시 받기
		AdminToken token = adminTokenRepository
				.findTopByAdminIdAndUsedYnOrderByTokenIdDesc(admin.getAdminId(), "N")
				.filter(t -> t.getTokenHistory().plusHours(TOKEN_HOURS).isAfter(now))
				.orElseThrow(() -> new BusinessException(ErrorCode.INVALID_INPUT, MSG_TOKEN_EXPIRED));

		// 2. 틀리면 실패 +1, 5번째면 30분 잠금
		if (!AdminUtil.matchesHash(request.getToken(), token.getTokenHash())) {
			admin.failLogin(now);
			if (admin.isLocked(now)) {
				throw new BusinessException(ErrorCode.ADMIN_LOCKED, MSG_LOCKED);
			}
			throw new BusinessException(ErrorCode.INVALID_INPUT, MSG_WRONG_TOKEN);
		}

		// 3. 맞으면 토큰 사용 처리, 실패 0, 마지막 로그인 / 4, 5. 세션에 관리자
		token.use();
		admin.succeedLogin(now);
		return startAdminSession(session, admin, now);
	}

	@Override
	@Transactional(readOnly = true)
	public AdminResponseDTO getSession(HttpSession session) {
		LoginAdminDTO loginAdmin = AdminUtil.getLoginAdmin(session);
		if (loginAdmin == null) {
			throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
		}
		LocalDateTime expiresAt = loginAdmin.getLoginAt().plusHours(AdminUtil.LOGIN_HOURS);
		if (expiresAt.isBefore(LocalDateTime.now())) {
			session.invalidate();
			throw new BusinessException(ErrorCode.LOGIN_REQUIRED, AdminUtil.MSG_SESSION_EXPIRED);
		}
		Admin admin = adminRepository.findById(loginAdmin.getAdminId())
				.filter(a -> a.getAdminStatus() == AdminStatus.ACTIVE)
				.orElse(null);
		if (admin == null) {	// 해제, 탈퇴됨
			session.invalidate();
			throw new BusinessException(ErrorCode.LOGIN_REQUIRED, AdminUtil.MSG_NO_PERMISSION);
		}
		return AdminResponseDTO.from(admin, null, expiresAt);
	}

	@Override
	public void logout(HttpSession session) {
		if (session != null) {
			session.invalidate();
		}
	}

	@Override
	public AdminResponseDTO startAdminSession(HttpSession session, Admin admin, LocalDateTime now) {
		authService.logout(session);	// 한 세션 한 역할: 회원 로그인 정보 삭제
		session.setAttribute(SessionConst.LOGIN_ADMIN,
				new LoginAdminDTO(admin.getAdminId(), admin.getAdminName(), admin.getAdminRole(), now));
		return AdminResponseDTO.from(admin, null, now.plusHours(AdminUtil.LOGIN_HOURS));
	}

	// 로그인할 수 있는 관리자: 없음(탈퇴, 해제 포함) 404 / 승인 대기 403 / 잠김 423 / 30분 지난 잠금은 풀어 줌
	private Admin findLoginableAdmin(String email, LocalDateTime now) {
		Admin admin = adminRepository.findByAdminEmail(AdminUtil.normalizeEmail(email))
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, MSG_NOT_REGISTERED));
		if (admin.getAdminStatus() == AdminStatus.PENDING) {
			throw new BusinessException(ErrorCode.FORBIDDEN, MSG_PENDING);
		}
		if (admin.getAdminStatus() != AdminStatus.ACTIVE) {
			throw new BusinessException(ErrorCode.NOT_FOUND, MSG_NOT_REGISTERED);
		}
		if (admin.isLocked(now)) {
			throw new BusinessException(ErrorCode.ADMIN_LOCKED, MSG_LOCKED);
		}
		if (admin.getLockedUntil() != null) {	// 잠금 시각이 지남 → 실패 횟수도 0
			admin.unlock();
		}
		return admin;
	}
}
