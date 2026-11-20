package chorong.common.util;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.scheduling.annotation.Scheduled;
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

	// "기능 이름:키(이메일, IP)" -> 마지막 요청 시각 (60초에 한 번 제한, ADMIN-02, 07)
	private final Map<String, Long> lastRequestTimes = new ConcurrentHashMap<>();

	/** 같은 키(이메일, IP)는 60초에 한 번, 넘으면 429 (관리자 토큰, 가입 인증 메일 폭탄 방지, B10, B17) */
	public synchronized void checkOncePerMinute(String action, String key) {
		String mapKey = action + ":" + key;
		long now = System.currentTimeMillis();
		Long last = lastRequestTimes.get(mapKey);
		if (last != null && now - last < WINDOW_MILLIS) {
			throw new BusinessException(ErrorCode.TOO_MANY_REQUESTS);
		}
		lastRequestTimes.put(mapKey, now);
	}

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

	/**
	 * 1분 지난 기록 지우기 (10분마다): 요청한 사람(세션, IP, 이메일)마다 쌓이는 기록이 끝없이 늘지 않게
	 * 지우는 것은 이미 제한에 안 쓰는 1분 지난 기록뿐이라 check, checkOncePerMinute 결과는 그대로
	 * (아주 드물게 지우는 순간 같은 사람의 새 요청이 겹치면 그 1건이 횟수에서 빠질 수 있음, 제한이 1번 느슨해질 뿐)
	 */
	@Scheduled(fixedDelay = 600_000L)
	public void cleanUp() {
		cleanUp(System.currentTimeMillis());
	}

	// 기준 시각으로 지우기 (테스트에서 시각을 정해 부름)
	void cleanUp(long now) {
		requestTimes.forEach((key, times) -> {
			synchronized (times) {
				while (!times.isEmpty() && now - times.peekFirst() >= WINDOW_MILLIS) {
					times.pollFirst();
				}
				if (times.isEmpty()) {
					requestTimes.remove(key, times);
				}
			}
		});
		lastRequestTimes.values().removeIf(last -> now - last >= WINDOW_MILLIS);
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
