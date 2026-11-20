package chorong.common.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * 같은 키 60초에 한 번 (관리자 토큰, 가입 인증 메일, B10, B17) / 1분 지난 기록 지우기
 */
class RequestLimiterTest {

	@Test
	void 같은_이메일로_60초_안에_다시_요청하면_429() {
		// Given
		RequestLimiter limiter = new RequestLimiter();
		limiter.checkOncePerMinute("adminTokenEmail", "a@test.com");

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> limiter.checkOncePerMinute("adminTokenEmail", "a@test.com"));

		// Then
		assertEquals(ErrorCode.TOO_MANY_REQUESTS, e.getErrorCode());
	}

	@Test
	void 다른_이메일은_막지_않음() {
		// Given
		RequestLimiter limiter = new RequestLimiter();
		limiter.checkOncePerMinute("adminTokenEmail", "a@test.com");

		// When, Then
		assertDoesNotThrow(() -> limiter.checkOncePerMinute("adminTokenEmail", "b@test.com"));
	}

	@Test
	void 정리할_때_1분_안의_기록은_남김() {
		// Given
		RequestLimiter limiter = new RequestLimiter();
		limiter.checkOncePerMinute("adminTokenEmail", "a@test.com");

		// When: 지금 기준으로 정리
		limiter.cleanUp(System.currentTimeMillis());

		// Then: 아직 1분이 안 지나 그대로 막힘
		assertThrows(BusinessException.class, () -> limiter.checkOncePerMinute("adminTokenEmail", "a@test.com"));
	}

	@Test
	void 정리하면_1분_지난_60초_기록이_지워짐() {
		// Given
		RequestLimiter limiter = new RequestLimiter();
		limiter.checkOncePerMinute("adminTokenEmail", "a@test.com");

		// When: 1분 뒤 시각으로 정리
		limiter.cleanUp(System.currentTimeMillis() + 60_001L);

		// Then: 기록이 지워져 다시 받을 수 있음
		assertDoesNotThrow(() -> limiter.checkOncePerMinute("adminTokenEmail", "a@test.com"));
	}

	@Test
	void 정리하면_1분_지난_횟수_기록이_지워짐() {
		// Given: 같은 IP가 1분에 10번 (다음은 429)
		RequestLimiter limiter = new RequestLimiter();
		MockHttpServletRequest request = new MockHttpServletRequest();
		for (int i = 0; i < 10; i++) {
			limiter.check("recommend", request);
		}

		// When: 1분 뒤 시각으로 정리
		limiter.cleanUp(System.currentTimeMillis() + 60_001L);

		// Then: 기록이 지워져 다시 부를 수 있음
		assertDoesNotThrow(() -> limiter.check("recommend", request));
	}
}
