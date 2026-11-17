package chorong.credit.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Optional;

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
import chorong.credit.dto.DiagnosisReportRequestDTO;
import chorong.credit.dto.DiagnosisReportResponseDTO;
import chorong.credit.entity.CreditBand;
import chorong.credit.service.DiagnosisReportService;

/*
 * 진단 결과 저장 (CREDIT-02) 공격 요청 테스트 (B3, B2)
 * 스프링 전체를 띄우지 않고 Controller + 오류 처리 + 로그인 확인만 연결 (DB 없음)
 */
class DiagnosisReportControllerTest {

	private static final String URL = "/api/me/reports/credit";
	private static final Long MEMBER_ID = 7L;

	private DiagnosisReportService service;
	private MockMvc mockMvc;
	private MockHttpSession loginSession;

	@BeforeEach
	void setUp() {
		service = mock(DiagnosisReportService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new DiagnosisReportController(service))
				.setControllerAdvice(new GlobalExceptionHandler())
				.addMappedInterceptors(new String[] {"/api/me/**"}, new LoginInterceptor())
				.build();

		loginSession = new MockHttpSession();
		loginSession.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(MEMBER_ID, "닉네임", "1995", "03-15"));
	}

	@Test
	void 로그인하지_않고_조회하면_401() throws Exception {
		// Given: 세션 없음

		// When, Then
		mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
		verifyNoInteractions(service);
	}

	@Test
	void 로그인하지_않고_저장하면_401() throws Exception {
		// Given: 세션 없음

		// When, Then
		mockMvc.perform(put(URL).contentType(MediaType.APPLICATION_JSON).content("{\"creditBand\":\"BAND1\"}"))
				.andExpect(status().isUnauthorized());
		verifyNoInteractions(service);
	}

	@Test
	void 로그인하지_않고_삭제하면_401() throws Exception {
		// Given: 세션 없음

		// When, Then
		mockMvc.perform(delete(URL)).andExpect(status().isUnauthorized());
		verifyNoInteractions(service);
	}

	@Test
	void 요청에_남의_회원_번호를_넣어도_세션_회원_번호로만_저장한다() throws Exception {
		// Given: 요청 본문에 memberId=999를 끼워 넣음
		when(service.saveReport(eq(MEMBER_ID), any())).thenReturn(new DiagnosisReportResponseDTO(CreditBand.BAND1, null));

		// When
		mockMvc.perform(put(URL).session(loginSession).contentType(MediaType.APPLICATION_JSON)
				.content("{\"creditBand\":\"BAND1\",\"memberId\":999}"));

		// Then
		verify(service).saveReport(eq(MEMBER_ID), any(DiagnosisReportRequestDTO.class));
	}

	@Test
	void 구간_5개_밖의_코드를_저장하면_400() throws Exception {
		// Given: BAND9
		// When, Then
		mockMvc.perform(put(URL).session(loginSession).contentType(MediaType.APPLICATION_JSON)
				.content("{\"creditBand\":\"BAND9\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("INVALID_INPUT"));
		verifyNoInteractions(service);
	}

	@Test
	void 구간이_없으면_400() throws Exception {
		// Given: 빈 본문 객체
		// When, Then
		mockMvc.perform(put(URL).session(loginSession).contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void 리포트가_없으면_조회는_204() throws Exception {
		// Given
		when(service.getReport(MEMBER_ID)).thenReturn(Optional.empty());

		// When, Then
		mockMvc.perform(get(URL).session(loginSession)).andExpect(status().isNoContent());
	}

	@Test
	void 리포트가_있으면_조회는_구간을_돌려준다() throws Exception {
		// Given
		when(service.getReport(MEMBER_ID)).thenReturn(Optional.of(new DiagnosisReportResponseDTO(CreditBand.BAND3, null)));

		// When, Then
		mockMvc.perform(get(URL).session(loginSession))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true))
				.andExpect(jsonPath("$.data.creditBand").value("BAND3"));
	}

	@Test
	void 삭제는_204이고_세션_회원_번호로만_지운다() throws Exception {
		// Given: 로그인 세션

		// When
		mockMvc.perform(delete(URL).session(loginSession)).andExpect(status().isNoContent());

		// Then
		verify(service).discardReport(MEMBER_ID);
	}
}
