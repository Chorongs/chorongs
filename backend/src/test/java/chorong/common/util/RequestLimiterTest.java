package chorong.common.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * 같은 키 60초에 한 번 (관리자 토큰, 가입 인증 메일, B10, B17)
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
}
