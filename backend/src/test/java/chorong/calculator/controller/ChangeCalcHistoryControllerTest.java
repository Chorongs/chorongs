package chorong.calculator.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.calculator.dto.ChangeCalcHistoryRequestDTO;
import chorong.calculator.service.ChangeCalcHistoryService;
import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.interceptor.LoginInterceptor;
import chorong.common.util.SessionConst;

/*
 * ChangeCalcHistoryController 테스트 (CAL-05 권한 B3, 입력 검사 B2)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 */
class ChangeCalcHistoryControllerTest {

	private static final Long MEMBER_ID = 1L;
	private static final String URL = "/api/me/change-calcs";

	private ChangeCalcHistoryService changeCalcHistoryService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		changeCalcHistoryService = mock(ChangeCalcHistoryService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new ChangeCalcHistoryController(changeCalcHistoryService))
				.addMappedInterceptors(new String[] { "/api/me/**" }, new LoginInterceptor())
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	private static MockHttpSession memberSession() {
		MockHttpSession session = new MockHttpSession();
		session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(MEMBER_ID, "회원", "1990", "01-01"));
		return session;
	}

	/** 올바른 본문. 값을 바꿀 칸은 "칸이름" -> 새 값으로 덮어씀 (문자열 치환) */
	private static String body(String... replaces) {
		String body = """
				{"currentRepayMethod": "EQUAL_PI", "currentBalance": 100000000, "currentRate": 4.5, "currentMonths": 120,
				 "newRepayMethod": "EQUAL_P", "newRate": 3.5, "newMonths": 120, "feeRate": 1.2, "etcCost": 500000,
				 "savingAmount": 1500000, "newFirstPayment": 800000, "newTotalInterest": 9000000}
				""";
		for (int i = 0; i < replaces.length; i += 2) {
			body = body.replaceAll("\"" + replaces[i] + "\": [^,}]+", "\"" + replaces[i] + "\": " + replaces[i + 1]);
		}
		return body;
	}

	private void assertPostStatus(String body, int expected) throws Exception {
		mockMvc.perform(post(URL).session(memberSession()).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().is(expected));
	}

	// ---- 로그인 확인 (비회원 401) ----

	@Test
	void 비회원이_목록을_보면_401() throws Exception {
		// Given, When, Then
		mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
	}

	@Test
	void 비회원이_저장하면_401이고_저장하지_않는다() throws Exception {
		// Given, When, Then
		mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body()))
				.andExpect(status().isUnauthorized());
		verify(changeCalcHistoryService, never()).saveChangeCalc(any(), any());
	}

	@Test
	void 비회원이_1건_삭제하면_401() throws Exception {
		// Given, When, Then
		mockMvc.perform(delete(URL + "/5")).andExpect(status().isUnauthorized());
	}

	@Test
	void 비회원이_전체_삭제하면_401() throws Exception {
		// Given, When, Then
		mockMvc.perform(delete(URL)).andExpect(status().isUnauthorized());
	}

	// ---- 회원 번호는 세션에서만 (B3) ----

	@Test
	void 저장은_세션의_회원_번호로_하고_요청의_memberId는_무시한다() throws Exception {
		// Given: 남의 번호 99를 요청 본문에 실어 보냄
		String body = body().replace("{", "{\"memberId\": 99, ");

		// When
		assertPostStatus(body, 201);

		// Then
		verify(changeCalcHistoryService).saveChangeCalc(eq(MEMBER_ID), any(ChangeCalcHistoryRequestDTO.class));
	}

	@Test
	void 삭제는_세션의_회원_번호와_기록_번호로_부른다() throws Exception {
		// Given, When
		mockMvc.perform(delete(URL + "/5").session(memberSession())).andExpect(status().isNoContent());

		// Then
		verify(changeCalcHistoryService).deleteChangeCalc(MEMBER_ID, 5L);
	}

	@Test
	void 전체_삭제는_세션의_회원_번호로_부른다() throws Exception {
		// Given, When
		mockMvc.perform(delete(URL).session(memberSession())).andExpect(status().isNoContent());

		// Then
		verify(changeCalcHistoryService).deleteChangeCalcs(MEMBER_ID);
	}

	@Test
	void 숫자가_아닌_기록_번호로_삭제하면_400() throws Exception {
		// Given, When, Then
		mockMvc.perform(delete(URL + "/abc").session(memberSession())).andExpect(status().isBadRequest());
	}

	// ---- 입력 검사 (B2) ----

	@Test
	void 올바른_값이면_201() throws Exception {
		// Given, When, Then
		assertPostStatus(body(), 201);
	}

	@Test
	void 아끼는_돈이_음수여도_201() throws Exception {
		// Given, When, Then
		assertPostStatus(body("savingAmount", "-1500000"), 201);
	}

	@Test
	void 아끼는_돈이_절댓값_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("savingAmount", "-1000000000000000"), 400);
		assertPostStatus(body("savingAmount", "1000000000000000"), 400);
	}

	@Test
	void 남은_대출금이_1만원_미만이면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("currentBalance", "9999"), 400);
	}

	@Test
	void 남은_대출금이_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("currentBalance", "10000000000"), 400);
	}

	@Test
	void 금리가_0_미만이거나_20_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("currentRate", "-0.1"), 400);
		assertPostStatus(body("currentRate", "20.01"), 400);
		assertPostStatus(body("newRate", "-0.1"), 400);
		assertPostStatus(body("newRate", "20.01"), 400);
	}

	@Test
	void 금리_0과_20은_통과한다() throws Exception {
		// Given, When, Then
		assertPostStatus(body("currentRate", "0", "newRate", "20"), 201);
	}

	@Test
	void 기간이_1_미만이거나_600_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("currentMonths", "0"), 400);
		assertPostStatus(body("currentMonths", "601"), 400);
		assertPostStatus(body("newMonths", "0"), 400);
		assertPostStatus(body("newMonths", "601"), 400);
	}

	@Test
	void 기간_1과_600은_통과한다() throws Exception {
		// Given, When, Then
		assertPostStatus(body("currentMonths", "1", "newMonths", "600"), 201);
	}

	@Test
	void 수수료율이_5_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("feeRate", "5.01"), 400);
	}

	@Test
	void 기타_비용이_음수이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("etcCost", "-1"), 400);
		assertPostStatus(body("etcCost", "10000000000"), 400);
	}

	@Test
	void 결과_칸이_음수이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("newFirstPayment", "-1"), 400);
		assertPostStatus(body("newTotalInterest", "1000000000000000"), 400);
	}

	@Test
	void 모르는_상환_방식_코드면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("currentRepayMethod", "\"UNKNOWN\""), 400);
		assertPostStatus(body("newRepayMethod", "\"UNKNOWN\""), 400);
	}

	@Test
	void 칸이_빠지면_400() throws Exception {
		// Given
		String body = """
				{"currentRepayMethod": "EQUAL_PI", "currentBalance": 100000000, "currentRate": 4.5, "currentMonths": 120}
				""";

		// When, Then
		assertPostStatus(body, 400);
	}

	@Test
	void 본문_형식이_틀리면_400() throws Exception {
		// Given, When, Then
		assertPostStatus("{not json", 400);
	}
}
