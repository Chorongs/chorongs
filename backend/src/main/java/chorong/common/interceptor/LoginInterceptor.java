package chorong.common.interceptor;

import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.LoginUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/*
 * 회원 로그인 확인 (등록 주소는 WebConfig)
 * 로그인 안 됐으면 redirect 하지 않고 예외를 던짐 -> GlobalExceptionHandler가 401 JSON
 */
public class LoginInterceptor implements HandlerInterceptor {

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		// CORS 사전 확인 요청(OPTIONS)은 쿠키가 없으므로 그대로 통과
		if (CorsUtils.isPreFlightRequest(request)) return true;

		if (LoginUtil.getLoginMember(request.getSession(false)) == null) {
			throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
		}
		return true;
	}
}
