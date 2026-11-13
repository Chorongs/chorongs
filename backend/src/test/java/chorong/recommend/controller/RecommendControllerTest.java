package chorong.recommend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.util.RequestLimiter;
import chorong.recommend.dto.RecommendResponseDTO;
import chorong.recommend.service.RecommendService;

/*
 * RecommendController 테스트 (LOAN-01, 05 입력 검사 B2, 반복 요청 제한 B10)
 * 서버를 띄우지 않고 Controller + 공통 오류 처리만 붙여 요청을 보냄 (MockMvc standalone)
 */
class RecommendControllerTest {

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		RecommendService recommendService = mock(RecommendService.class);
		when(recommendService.getRecommendations(any(), any()))
				.thenReturn(new RecommendResponseDTO(0, List.of(), List.of(), null, List.of()));
		mockMvc = MockMvcBuilders.standaloneSetup(new RecommendController(recommendService, new RequestLimiter()))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	// 기본 입력에서 칸 하나만 바꾼 JSON
	private static String body(String job, String region, int need, String priorities) {
		return """
				{"job": "%s", "ageGroup": "ADULT", "region": %s, "income": 4000, "debtMonthly": 0,
				 "debtUnknown": false, "purpose": "생활비", "need": %d, "months": 36, "creditBand": "BAND3",
				 "overdue": false, "priorities": %s}
				""".formatted(job, region, need, priorities);
	}

	private static String validBody() {
		return body("OFFICE", "\"서울\"", 1000, "[\"LOW_RATE\"]");
	}

	@Test
	void 정상_요청은_200() throws Exception {
		// Given
		String body = validBody();

		// When, Then
		mockMvc.perform(post("/api/recommendations").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk());
	}

	@Test
	void 모르는_직업_코드는_400() throws Exception {
		// Given
		String body = body("CEO", "\"서울\"", 1000, "[\"LOW_RATE\"]");

		// When, Then
		mockMvc.perform(post("/api/recommendations").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 모르는_지역은_400() throws Exception {
		// Given
		String body = body("OFFICE", "\"서울특별시\"", 1000, "[\"LOW_RATE\"]");

		// When, Then
		mockMvc.perform(post("/api/recommendations").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 필요_금액이_범위_밖이면_400() throws Exception {
		// Given: 10만원 미만
		String body = body("OFFICE", "\"서울\"", 9, "[\"LOW_RATE\"]");

		// When, Then
		mockMvc.perform(post("/api/recommendations").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 고른_기준이_4개면_400() throws Exception {
		// Given
		String body = body("OFFICE", "\"서울\"", 1000, "[\"LOW_RATE\", \"HIGH_LIMIT\", \"ONLINE\", \"POLICY\"]");

		// When, Then
		mockMvc.perform(post("/api/recommendations").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 모르는_고른_기준_코드는_400() throws Exception {
		// Given
		String body = body("OFFICE", "\"서울\"", 1000, "[\"FAST\"]");

		// When, Then
		mockMvc.perform(post("/api/recommendations").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 같은_곳에서_1분에_11번째_요청은_429() throws Exception {
		// Given: 같은 IP에서 10번 요청
		for (int i = 0; i < 10; i++) {
			mockMvc.perform(post("/api/recommendations").contentType(MediaType.APPLICATION_JSON).content(validBody()));
		}

		// When, Then
		mockMvc.perform(post("/api/recommendations").contentType(MediaType.APPLICATION_JSON).content(validBody()))
				.andExpect(status().isTooManyRequests());
	}

	@Test
	void 판정_숫자_아닌_상품_번호는_400() throws Exception {
		// Given
		String body = validBody();

		// When, Then
		mockMvc.perform(post("/api/products/abc/eligibility").contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isBadRequest());
	}
}
