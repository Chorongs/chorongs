package chorong.calculator.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.calculator.dto.CalcHistoryRequestDTO;
import chorong.calculator.service.CalcHistoryService;
import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.interceptor.LoginInterceptor;
import chorong.common.util.SessionConst;

/*
 * CalcHistoryController 테스트 (CAL-04 권한 B3, 입력 검사 B2)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 */
class CalcHistoryControllerTest {

	private static final Long MEMBER_ID = 1L;
	private static final String URL = "/api/me/calcs";

	private CalcHistoryService calcHistoryService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		calcHistoryService = mock(CalcHistoryService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new CalcHistoryController(calcHistoryService))
				.addMappedInterceptors(new String[] { "/api/me/**" }, new LoginInterceptor())
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	private static MockHttpSession memberSession() {
		MockHttpSession session = new MockHttpSession();
		session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(MEMBER_ID, "회원", "1990", "01-01"));
		return session;
	}

	private static String body(String loanAmount, String interestRate, String repayMethod) {
		return """
				{"loanAmount": %s, "loanMonths": 36, "interestRate": %s, "repayMethod": "%s",
				 "graceMonths": 0, "totalInterest": 1234567, "firstPayment": 860000}
				""".formatted(loanAmount, interestRate, repayMethod);
	}

	// 기본 값에 옵션 칸을 덧붙인 본문 (extra는 "칸": 값, ... 형태)
	private static String bodyWith(String extra) {
		return """
				{"loanAmount": 10000000, "loanMonths": 36, "interestRate": 4.5, "repayMethod": "EQUAL_PI",
				 "graceMonths": 0, "totalInterest": 1234567, "firstPayment": 860000, %s}
				""".formatted(extra);
	}

	private static final String PREPAY_OK = "\"prepayRound\": 12, \"prepayAmount\": 3000000, \"prepayFeeRate\": 1.2, \"prepayMode\": \"SHORTEN_TERM\"";

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
		// Given
		String body = body("10000000", "4.5", "EQUAL_PI");

		// When, Then
		mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isUnauthorized());
		verify(calcHistoryService, never()).saveCalc(any(), any());
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
		String body = """
				{"memberId": 99, "loanAmount": 10000000, "loanMonths": 36, "interestRate": 4.5,
				 "repayMethod": "EQUAL_PI", "graceMonths": 0, "totalInterest": 1234567, "firstPayment": 860000}
				""";

		// When
		mockMvc.perform(post(URL).session(memberSession()).contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isCreated());

		// Then
		verify(calcHistoryService).saveCalc(eq(MEMBER_ID), any(CalcHistoryRequestDTO.class));
	}

	@Test
	void 삭제는_세션의_회원_번호와_기록_번호로_부른다() throws Exception {
		// Given, When
		mockMvc.perform(delete(URL + "/5").session(memberSession())).andExpect(status().isNoContent());

		// Then
		verify(calcHistoryService).deleteCalc(MEMBER_ID, 5L);
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
		assertPostStatus(body("10000000", "4.5", "EQUAL_PI"), 201);
	}

	@Test
	void 대출금액이_1만원_미만이면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("9999", "4.5", "EQUAL_PI"), 400);
	}

	@Test
	void 이자율이_0_미만이면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("10000000", "-0.1", "EQUAL_PI"), 400);
	}

	@Test
	void 이자율이_20_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("10000000", "20.01", "EQUAL_PI"), 400);
	}

	@Test
	void 이자율_0과_20은_통과한다() throws Exception {
		// Given, When, Then
		assertPostStatus(body("10000000", "0", "EQUAL_PI"), 201);
		assertPostStatus(body("10000000", "20", "EQUAL_PI"), 201);
	}

	@Test
	void 모르는_상환_방식_코드면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("10000000", "4.5", "UNKNOWN"), 400);
	}

	@Test
	void 상환_방식이_없으면_400() throws Exception {
		// Given
		String body = """
				{"loanAmount": 10000000, "loanMonths": 36, "interestRate": 4.5,
				 "graceMonths": 0, "totalInterest": 1234567, "firstPayment": 860000}
				""";

		// When, Then
		assertPostStatus(body, 400);
	}

	@Test
	void 기록_값이_음수면_400() throws Exception {
		// Given
		String body = """
				{"loanAmount": 10000000, "loanMonths": 36, "interestRate": 4.5, "repayMethod": "EQUAL_PI",
				 "graceMonths": 0, "totalInterest": -1, "firstPayment": 860000}
				""";

		// When, Then
		assertPostStatus(body, 400);
	}

	@Test
	void 본문_형식이_틀리면_400() throws Exception {
		// Given, When, Then
		assertPostStatus("{not json", 400);
	}

	// ---- 입력 검사: 옵션 칸 (B2) ----

	@Test
	void 중도상환_4칸이_모두_있으면_201() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWith(PREPAY_OK), 201);
	}

	@Test
	void 옵션_칸은_서비스로_그대로_넘어간다() throws Exception {
		// Given
		String body = bodyWith(PREPAY_OK + ", \"changeRound\": 6, \"changeRate\": 7.5");

		// When
		assertPostStatus(body, 201);

		// Then
		ArgumentCaptor<CalcHistoryRequestDTO> captor = ArgumentCaptor.forClass(CalcHistoryRequestDTO.class);
		verify(calcHistoryService).saveCalc(eq(MEMBER_ID), captor.capture());
		assertEquals(12, captor.getValue().getPrepayRound());
	}

	@Test
	void 모르는_중도상환_방식이면_400() throws Exception {
		// Given
		String body = bodyWith("\"prepayRound\": 12, \"prepayAmount\": 3000000, \"prepayFeeRate\": 1.2, \"prepayMode\": \"UNKNOWN\"");

		// When, Then
		assertPostStatus(body, 400);
	}

	@Test
	void 중도상환_금액이_1만원_미만이면_400() throws Exception {
		// Given
		String body = bodyWith("\"prepayRound\": 12, \"prepayAmount\": 9999, \"prepayFeeRate\": 1.2, \"prepayMode\": \"SHORTEN_TERM\"");

		// When, Then
		assertPostStatus(body, 400);
	}

	@Test
	void 중도상환_수수료율이_5_초과면_400() throws Exception {
		// Given
		String body = bodyWith("\"prepayRound\": 12, \"prepayAmount\": 3000000, \"prepayFeeRate\": 5.01, \"prepayMode\": \"SHORTEN_TERM\"");

		// When, Then
		assertPostStatus(body, 400);
	}

	@Test
	void 중도상환_회차가_0이면_400() throws Exception {
		// Given
		String body = bodyWith("\"prepayRound\": 0, \"prepayAmount\": 3000000, \"prepayFeeRate\": 1.2, \"prepayMode\": \"SHORTEN_TERM\"");

		// When, Then
		assertPostStatus(body, 400);
	}

	@Test
	void 금리_변동이_올바르면_201() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWith("\"changeRound\": 6, \"changeRate\": 7.5"), 201);
	}

	@Test
	void 변동_후_금리가_20_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWith("\"changeRound\": 6, \"changeRate\": 20.01"), 400);
	}

	@Test
	void 증가율이_20_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWith("\"growthRate\": 20.01"), 400);
	}
}
