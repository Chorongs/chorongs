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

import java.util.Collections;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.calculator.dto.HomeLimitCalcHistoryRequestDTO;
import chorong.calculator.service.HomeLimitCalcHistoryService;
import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.interceptor.LoginInterceptor;
import chorong.common.util.SessionConst;

/*
 * HomeLimitCalcHistoryController 테스트 (CAL-08 권한 B3, 입력 검사 B2)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 */
class HomeLimitCalcHistoryControllerTest {

	private static final Long MEMBER_ID = 1L;
	private static final String URL = "/api/me/home-calcs";

	private HomeLimitCalcHistoryService homeLimitCalcHistoryService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		homeLimitCalcHistoryService = mock(HomeLimitCalcHistoryService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new HomeLimitCalcHistoryController(homeLimitCalcHistoryService))
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
				{"housePrice": 500000000, "homeRegion": "REGULATED", "firstHome": "Y", "annualIncome": 80000000,
				 "otherInterest": 2000000, "interestRate": 4.5, "loanYears": 30, "repayMethod": "EQUAL_PI",
				 "maxLoan": 300000000, "ltvLimit": 250000000, "dtiLimit": 300000000, "rateType": "VARIABLE"}
				""";
		for (int i = 0; i < replaces.length; i += 2) {
			body = body.replaceAll("\"" + replaces[i] + "\": [^,}]+", "\"" + replaces[i] + "\": " + replaces[i + 1]);
		}
		return body;
	}

	/** 올바른 본문 + 다른 대출 목록 (JSON 배열 글자 그대로) */
	private static String bodyWithLoans(String loansJson) {
		return body().replace("\"rateType\": \"VARIABLE\"}", "\"rateType\": \"VARIABLE\", \"otherLoans\": " + loansJson + "}");
	}

	/** 다른 대출 1건 (값을 바꿀 칸은 "칸이름" -> 새 값) */
	private static String loan(String... replaces) {
		String loan = "{\"loanKind\": \"CREDIT\", \"repayMethod\": \"EQUAL_PI\", \"loanAmount\": 30000000, \"interestRate\": 5, \"loanMonths\": 60}";
		for (int i = 0; i < replaces.length; i += 2) {
			loan = loan.replaceAll("\"" + replaces[i] + "\": [^,}]+", "\"" + replaces[i] + "\": " + replaces[i + 1]);
		}
		return loan;
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
		verify(homeLimitCalcHistoryService, never()).saveHomeCalc(any(), any());
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
		verify(homeLimitCalcHistoryService).saveHomeCalc(eq(MEMBER_ID), any(HomeLimitCalcHistoryRequestDTO.class));
	}

	@Test
	void 삭제는_세션의_회원_번호와_기록_번호로_부른다() throws Exception {
		// Given, When
		mockMvc.perform(delete(URL + "/5").session(memberSession())).andExpect(status().isNoContent());

		// Then
		verify(homeLimitCalcHistoryService).deleteHomeCalc(MEMBER_ID, 5L);
	}

	@Test
	void 전체_삭제는_세션의_회원_번호로_부른다() throws Exception {
		// Given, When
		mockMvc.perform(delete(URL).session(memberSession())).andExpect(status().isNoContent());

		// Then
		verify(homeLimitCalcHistoryService).deleteHomeCalcs(MEMBER_ID);
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
	void 집값이_1만원_미만이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("housePrice", "9999"), 400);
		assertPostStatus(body("housePrice", "10000000000"), 400);
	}

	@Test
	void 연소득이_1만원_미만이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("annualIncome", "9999"), 400);
		assertPostStatus(body("annualIncome", "10000000000"), 400);
	}

	@Test
	void 다른_대출_이자가_음수이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("otherInterest", "-1"), 400);
		assertPostStatus(body("otherInterest", "10000000000"), 400);
	}

	@Test
	void 다른_대출_이자_0은_통과한다() throws Exception {
		// Given, When, Then
		assertPostStatus(body("otherInterest", "0"), 201);
	}

	@Test
	void 금리가_0_미만이거나_20_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("interestRate", "-0.1"), 400);
		assertPostStatus(body("interestRate", "20.01"), 400);
	}

	@Test
	void 기간이_1_미만이거나_50_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("loanYears", "0"), 400);
		assertPostStatus(body("loanYears", "51"), 400);
	}

	@Test
	void 기간_1과_50은_통과한다() throws Exception {
		// Given, When, Then
		assertPostStatus(body("loanYears", "1"), 201);
		assertPostStatus(body("loanYears", "50"), 201);
	}

	@Test
	void 결과_3칸이_음수이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("maxLoan", "-1"), 400);
		assertPostStatus(body("ltvLimit", "1000000000000000"), 400);
		assertPostStatus(body("dtiLimit", "-1"), 400);
	}

	@Test
	void 모르는_지역_코드면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("homeRegion", "\"UNKNOWN\""), 400);
	}

	@Test
	void 생애_최초는_Y와_N만_받는다() throws Exception {
		// Given, When, Then
		assertPostStatus(body("firstHome", "\"N\""), 201);
		assertPostStatus(body("firstHome", "\"X\""), 400);
		assertPostStatus(body("firstHome", "\"y\""), 400);
		assertPostStatus(body("firstHome", "\"YN\""), 400);
	}

	@Test
	void 모르는_상환_방식_코드면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("repayMethod", "\"UNKNOWN\""), 400);
	}

	@Test
	void 칸이_빠지면_400() throws Exception {
		// Given
		String body = """
				{"housePrice": 500000000, "homeRegion": "OTHER", "firstHome": "N"}
				""";

		// When, Then
		assertPostStatus(body, 400);
	}

	@Test
	void 본문_형식이_틀리면_400() throws Exception {
		// Given, When, Then
		assertPostStatus("{not json", 400);
	}

	// ---- 금리 유형, 다른 대출 (2026-11-26, B2) ----

	@Test
	void 금리_유형이_없으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body().replace(", \"rateType\": \"VARIABLE\"", ""), 400);
	}

	@Test
	void 모르는_금리_유형_코드면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(body("rateType", "\"STRESS\""), 400);
	}

	@Test
	void 금리_유형_3개는_통과한다() throws Exception {
		// Given, When, Then
		assertPostStatus(body("rateType", "\"MIXED\""), 201);
		assertPostStatus(body("rateType", "\"FIXED\""), 201);
	}

	@Test
	void 다른_대출을_넣으면_201() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans("[" + loan() + ", " + loan("loanKind", "\"OTHER\"", "repayMethod", "\"BULLET\"") + "]"), 201);
	}

	@Test
	void 다른_대출이_빈_목록이면_201() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans("[]"), 201);
	}

	@Test
	void 다른_대출이_11건이면_400() throws Exception {
		// Given
		String loans = "[" + String.join(", ", Collections.nCopies(11, loan())) + "]";

		// When, Then
		assertPostStatus(bodyWithLoans(loans), 400);
	}

	@Test
	void 다른_대출_잔액이_0이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans("[" + loan("loanAmount", "0") + "]"), 400);
		assertPostStatus(bodyWithLoans("[" + loan("loanAmount", "10000000000") + "]"), 400);
	}

	@Test
	void 다른_대출_금리가_0_미만이거나_20_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans("[" + loan("interestRate", "-0.1") + "]"), 400);
		assertPostStatus(bodyWithLoans("[" + loan("interestRate", "20.01") + "]"), 400);
	}

	@Test
	void 다른_대출_남은_기간이_1_미만이거나_600_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans("[" + loan("loanMonths", "0") + "]"), 400);
		assertPostStatus(bodyWithLoans("[" + loan("loanMonths", "601") + "]"), 400);
	}

	@Test
	void 다른_대출_종류나_상환_방식_코드를_모르면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans("[" + loan("loanKind", "\"CARD\"") + "]"), 400);
		assertPostStatus(bodyWithLoans("[" + loan("repayMethod", "\"UNKNOWN\"") + "]"), 400);
	}

	@Test
	void 다른_대출_칸이_빠지면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans("[{\"loanKind\": \"CREDIT\"}]"), 400);
	}

	@Test
	void 다른_대출_목록에_빈_항목이_있으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans("[null]"), 400);
	}
}
