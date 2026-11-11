package chorong.common.util;

import chorong.common.dto.LoginAdminDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import jakarta.servlet.http.HttpSession;

/*
 * 세션에서 로그인 관리자 꺼내기 (회원 세션과 따로)
 */
public class AdminUtil {

	private AdminUtil() {}

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
}
