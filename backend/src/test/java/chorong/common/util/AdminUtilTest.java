package chorong.common.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/*
 * 관리자 토큰 만들기, 해시 (B17)
 */
class AdminUtilTest {

	@Test
	void 토큰은_숫자_6자리() {
		// Given, When
		String token = AdminUtil.newToken();

		// Then
		assertTrue(token.matches("\\d{6}"));
	}

	@Test
	void 해시는_16진수_64자() {
		// Given, When
		String hash = AdminUtil.sha256("123456");

		// Then
		assertTrue(hash.matches("[0-9a-f]{64}"));
	}

	@Test
	void 같은_값이면_해시가_맞음() {
		// Given
		String hash = AdminUtil.sha256("123456");

		// When
		boolean matches = AdminUtil.matchesHash("123456", hash);

		// Then
		assertTrue(matches);
	}

	@Test
	void 다른_값이면_해시가_안_맞음() {
		// Given
		String hash = AdminUtil.sha256("123456");

		// When
		boolean matches = AdminUtil.matchesHash("654321", hash);

		// Then
		assertFalse(matches);
	}

	@Test
	void 이메일은_공백_빼고_소문자로() {
		// Given, When
		String email = AdminUtil.normalizeEmail("  Admin@Test.COM ");

		// Then
		assertEquals("admin@test.com", email);
	}
}
