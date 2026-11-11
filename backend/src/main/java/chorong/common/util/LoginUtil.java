package chorong.common.util;

import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import jakarta.servlet.http.HttpSession;

/*
 * 세션에서 로그인 회원 꺼내기 (회원 번호는 세션에서만 꺼냄, B3)
 * Controller에서 HttpSession을 받아 사용
 */
public class LoginUtil {

	private LoginUtil() {}

	/** 로그인 회원, 없으면 null (비회원도 쓰는 기능) */
	public static LoginMemberDTO getLoginMember(HttpSession session) {
		if (session == null) return null;
		return (LoginMemberDTO) session.getAttribute(SessionConst.LOGIN_MEMBER);
	}

	/** 로그인 회원 번호, 없으면 401 (로그인이 필요한 기능) */
	public static Long getMemberId(HttpSession session) {
		LoginMemberDTO loginMember = getLoginMember(session);
		if (loginMember == null) throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
		return loginMember.getMemberId();
	}
}
