package chorong.common.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Locale;

import chorong.common.dto.LoginAdminDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import jakarta.servlet.http.HttpSession;

/*
 * 관리자 공통: 세션에서 로그인 관리자 꺼내기 (회원 세션과 따로), 로그인 2시간과 401 문구,
 * 토큰 6자리와 해시 (B17), 이메일 비교용 정리
 */
public class AdminUtil {

	private AdminUtil() {}

	/** 관리자 로그인 유지 시간: 로그인 + 2시간 고정, 활동해도 연장 없음 (B4, AdminInterceptor, 관리자 서비스가 같이 씀) */
	public static final long LOGIN_HOURS = 2;

	/** 관리자 401 문구 (관리자 상세 기획 4-11 문구 12, 13): 2시간 지남 / 해제, 탈퇴됨 */
	public static final String MSG_SESSION_EXPIRED = "2시간이 지나 자동으로 로그아웃했어요";
	public static final String MSG_NO_PERMISSION = "관리자 권한이 없어졌어요";

	/** 로그인 관리자, 없으면 null */
	public static LoginAdminDTO getLoginAdmin(HttpSession session) {
		if (session == null) return null;
		return (LoginAdminDTO) session.getAttribute(SessionConst.LOGIN_ADMIN);
	}

	/** 로그인 관리자 번호, 없으면 401 */
	public static Long getAdminId(HttpSession session) {
		LoginAdminDTO loginAdmin = getLoginAdmin(session);
		if (loginAdmin == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
		return loginAdmin.getAdminId();
	}

	// ---- 관리자 토큰 (B17: SecureRandom 6자리, 저장은 SHA-256 해시만) ----

	private static final SecureRandom RANDOM = new SecureRandom();
	private static final int TOKEN_BOUND = 1_000_000;	// 000000 ~ 999999

	/** 6자리 토큰 원문 (메일로만 보내고 저장, 로그 금지) */
	public static String newToken() {
		return String.format("%06d", RANDOM.nextInt(TOKEN_BOUND));
	}

	/** SHA-256 16진수 64자 */
	public static String sha256(String value) {
		try {
			MessageDigest md = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}

	/** 입력값의 해시가 저장된 해시와 같은지 (시간이 일정한 비교) */
	public static boolean matchesHash(String value, String savedHash) {
		if (value == null || savedHash == null) return false;
		return MessageDigest.isEqual(sha256(value).getBytes(StandardCharsets.UTF_8),
				savedHash.getBytes(StandardCharsets.UTF_8));
	}

	/** 관리자 이메일 비교용: 앞뒤 공백 제거 + 소문자 */
	public static String normalizeEmail(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}
}
