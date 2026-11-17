package chorong.recommend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.interceptor.LoginInterceptor;
import chorong.common.util.SessionConst;
import chorong.recommend.service.RecommendResultService;

/*
 * RecommendResultController 테스트 (LOAN-04 권한 B3, 입력 검사 B2)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 * 기획서 7-1 시나리오 15 포함
 */
class RecommendResultControllerTest {

	private static final Long MEMBER_ID = 1L;
	private static final String URL = "/api/me/recommendations";

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		RecommendResultService recommendResultService = mock(RecommendResultService.class);
		when(recommendResultService.saveRecommendResult(eq(MEMBER_ID), any())).thenReturn(7L);
		mockMvc = MockMvcBuilders.standaloneSetup(new RecommendResultController(recommendResultService))
				.addMappedInterceptors(new String[] { "/api/me/**" }, new LoginInterceptor())
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	private static MockHttpSession memberSession() {
		MockHttpSession session = new MockHttpSession();
		session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(MEMBER_ID, "회원", "1990", "01-01"));
		return session;
	}

	private static String body(String productIds) {
		return """
				{"purpose": "생활비", "need": 1000, "months": 36, "job": "OFFICE", "productIds": %s}
				""".formatted(productIds);
	}

	@Test
	void 시나리오15_비회원이_저장하면_401() throws Exception {
		// Given
		String body = body("[11, 12]");

		// When, Then
		mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void 시나리오13_회원이_저장하면_201() throws Exception {
		// Given
		String body = body("[11, 12]");

		// When, Then
		mockMvc.perform(post(URL).session(memberSession()).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isCreated());
	}

	@Test
	void 저장할_상품이_없으면_400() throws Exception {
		// Given
		String body = body("[]");

		// When, Then
		mockMvc.perform(post(URL).session(memberSession()).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 저장할_상품이_31개면_400() throws Exception {
		// Given
		StringBuilder ids = new StringBuilder("[");
		for (int i = 1; i <= 31; i++) {
			ids.append(i).append(i < 31 ? "," : "]");
		}
		String body = body(ids.toString());

		// When, Then
		mockMvc.perform(post(URL).session(memberSession()).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
	}
}
