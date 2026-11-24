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
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.calculator.dto.DsrCalcRequestDTO;
import chorong.calculator.service.DsrCalcService;
import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.interceptor.LoginInterceptor;
import chorong.common.util.SessionConst;

/*
 * DsrCalcController 테스트 (CAL-06 권한 B3, 입력 검사 B2)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 */
class DsrCalcControllerTest {

	private static final Long MEMBER_ID = 1L;
	private static final String URL = "/api/me/dsr-calcs";
	private static final String LOAN = """
			{"loanKind": "MORTGAGE", "repayMethod": "EQUAL_PI", "loanAmount": 200000000, "interestRate": 4.5, "loanMonths": 360}""";

	private DsrCalcService dsrCalcService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		dsrCalcService = mock(DsrCalcService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new DsrCalcController(dsrCalcService))
				.addMappedInterceptors(new String[] { "/api/me/**" }, new LoginInterceptor())
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	private static MockHttpSession memberSession() {
		MockHttpSession session = new MockHttpSession();
		session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(MEMBER_ID, "회원", "1990", "01-01"));
		return session;
	}

	/** 대출 목록을 loans 칸에 넣은 본문 (loans는 [..] 안의 JSON 문자열) */
	private static String bodyWithLoans(String loans) {
		return """
				{"annualIncome": 60000000, "dsrRate": 35.5, "yearlyPayment": 21300000, "loans": [%s]}
				""".formatted(loans);
	}

	private static String loans(int count) {
		return Collections.nCopies(count, LOAN).stream().collect(Collectors.joining(","));
	}

	/** 올바른 본문(대출 1건)에서 칸 하나를 바꿈 (최상위 칸) */
	private static String bodyWith(String field, String value) {
		return bodyWithLoans(LOAN).replaceAll("\"" + field + "\": [^,}]+", "\"" + field + "\": " + value);
	}

	/** 올바른 본문(대출 1건)에서 대출 칸 하나를 바꿈 */
	private static String bodyWithLoanField(String field, String value) {
		String changedLoan = LOAN.replaceAll("\"" + field + "\": [^,}]+", "\"" + field + "\": " + value);
		return bodyWithLoans(changedLoan);
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
		mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(bodyWithLoans(LOAN)))
				.andExpect(status().isUnauthorized());
		verify(dsrCalcService, never()).saveDsrCalc(any(), any());
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
		String body = bodyWithLoans(LOAN).replace("{\"annualIncome\"", "{\"memberId\": 99, \"annualIncome\"");

		// When
		assertPostStatus(body, 201);

		// Then
		verify(dsrCalcService).saveDsrCalc(eq(MEMBER_ID), any(DsrCalcRequestDTO.class));
	}

	@Test
	void 삭제는_세션의_회원_번호와_기록_번호로_부른다() throws Exception {
		// Given, When
		mockMvc.perform(delete(URL + "/5").session(memberSession())).andExpect(status().isNoContent());

		// Then
		verify(dsrCalcService).deleteDsrCalc(MEMBER_ID, 5L);
	}

	@Test
	void 전체_삭제는_세션의_회원_번호로_부른다() throws Exception {
		// Given, When
		mockMvc.perform(delete(URL).session(memberSession())).andExpect(status().isNoContent());

		// Then
		verify(dsrCalcService).deleteDsrCalcs(MEMBER_ID);
	}

	@Test
	void 숫자가_아닌_기록_번호로_삭제하면_400() throws Exception {
		// Given, When, Then
		mockMvc.perform(delete(URL + "/abc").session(memberSession())).andExpect(status().isBadRequest());
	}

	// ---- 입력 검사: 대출 건수 (B2) ----

	@Test
	void 대출이_1건이면_201() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans(loans(1)), 201);
	}

	@Test
	void 대출이_10건이면_201() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans(loans(10)), 201);
	}

	@Test
	void 대출이_0건이면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans(""), 400);
	}

	@Test
	void 대출이_11건이면_400이고_저장하지_않는다() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans(loans(11)), 400);
		verify(dsrCalcService, never()).saveDsrCalc(any(), any());
	}

	@Test
	void 대출_목록_칸이_없으면_400() throws Exception {
		// Given
		String body = """
				{"annualIncome": 60000000, "dsrRate": 35.5, "yearlyPayment": 21300000}
				""";

		// When, Then
		assertPostStatus(body, 400);
	}

	@Test
	void 대출_목록에_null이_섞이면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoans(Stream.of(LOAN, "null").collect(Collectors.joining(","))), 400);
	}

	// ---- 입력 검사: 계산 칸 (B2) ----

	@Test
	void 연소득이_1만원_미만이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWith("annualIncome", "9999"), 400);
		assertPostStatus(bodyWith("annualIncome", "10000000000"), 400);
	}

	@Test
	void DSR이_음수이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWith("dsrRate", "-0.01"), 400);
		assertPostStatus(bodyWith("dsrRate", "100000000000"), 400);
	}

	@Test
	void DSR_0과_상한은_통과한다() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWith("dsrRate", "0"), 201);
		assertPostStatus(bodyWith("dsrRate", "99999999999.99"), 201);
	}

	@Test
	void 연간_원리금이_음수이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWith("yearlyPayment", "-1"), 400);
		assertPostStatus(bodyWith("yearlyPayment", "1000000000000000"), 400);
	}

	// ---- 입력 검사: 대출 칸 (B2) ----

	@Test
	void 대출금액이_1만원_미만이거나_상한을_넘으면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoanField("loanAmount", "9999"), 400);
		assertPostStatus(bodyWithLoanField("loanAmount", "10000000000"), 400);
	}

	@Test
	void 대출_금리가_0_미만이거나_20_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoanField("interestRate", "-0.1"), 400);
		assertPostStatus(bodyWithLoanField("interestRate", "20.01"), 400);
	}

	@Test
	void 대출_기간이_1_미만이거나_600_초과면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoanField("loanMonths", "0"), 400);
		assertPostStatus(bodyWithLoanField("loanMonths", "601"), 400);
	}

	@Test
	void 모르는_대출_종류_코드면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoanField("loanKind", "\"UNKNOWN\""), 400);
	}

	@Test
	void 모르는_상환_방식_코드면_400() throws Exception {
		// Given, When, Then
		assertPostStatus(bodyWithLoanField("repayMethod", "\"UNKNOWN\""), 400);
	}

	@Test
	void 본문_형식이_틀리면_400() throws Exception {
		// Given, When, Then
		assertPostStatus("{not json", 400);
	}
}
