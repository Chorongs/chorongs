package chorong.common.util;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

/*
 * 반복 요청 제한 (B10): 같은 세션(비회원은 IP)이 같은 기능을 1분에 10회 넘게 부르면 429
 * Controller에서 호출. 사용 예: requestLimiter.check("report", request);
 */
@Component
public class RequestLimiter {

	private static final int MAX_COUNT = 10;				// 1분 최대 횟수
	private static final long WINDOW_MILLIS = 60_000L;		// 1분

	// "기능 이름:세션 아이디 또는 IP" -> 최근 1분 요청 시각 목록
	private final Map<String, Deque<Long>> requestTimes = new ConcurrentHashMap<>();

	public void check(String action, HttpServletRequest request) {
		String key = action + ":" + getRequester(request);
		long now = System.currentTimeMillis();
		Deque<Long> times = requestTimes.computeIfAbsent(key, k -> new ArrayDeque<>());

		// 같은 사람의 요청이 동시에 와도 횟수가 꼬이지 않게 묶어서 처리
		synchronized (times) {
			// 1분 지난 기록은 버림
			while (!times.isEmpty() && now - times.peekFirst() >= WINDOW_MILLIS) {
				times.pollFirst();
			}
			if (times.size() >= MAX_COUNT) {
				throw new BusinessException(ErrorCode.TOO_MANY_REQUESTS);
			}
			times.addLast(now);
		}
	}

	// 로그인 회원은 세션 아이디, 비회원은 IP
	private String getRequester(HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		if (LoginUtil.getLoginMember(session) != null) {
			return session.getId();
		}
		return request.getRemoteAddr();
	}
}
