package chorong.help.controller;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.util.RequestLimiter;
import chorong.help.dto.HelpContentResponseDTO;
import chorong.help.service.HelpService;

/*
 * HELP-01 GET /api/help/faqs, HELP-02 GET /api/help/terms, HELP-03 GET /api/help/tips 주소 테스트
 * 기대값 출처: be_help.md HELP-02 (API-10, 권한: 모두, 응답 = 용어 목록: 이름, 분류, 설명, 관련 단어)
 * 응답 칸 이름(helpNo, category, title, content, keywords)은 명세서에 없어 DTO에서 정한 값 (프론트와 맞출 것)
 * Service는 Mockito 가짜
 */
class HelpControllerTest {

	private HelpService helpService;
	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		helpService = mock(HelpService.class);
		mockMvc = MockMvcBuilders.standaloneSetup(new HelpController(helpService, mock(RequestLimiter.class)))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
		when(helpService.getTerms()).thenReturn(
				List.of(new HelpContentResponseDTO(11L, 1, "금리", "연이율", "한 해 이자 비율", List.of("이자"), null, null)));
	}

	@Test
	void 로그인하지_않아도_200이다() throws Exception {
		// Given (세션 없음), When, Then
		mockMvc.perform(get("/api/help/terms"))
				.andExpect(status().isOk());
	}

	@Test
	void Service에서_용어_목록을_가져온다() throws Exception {
		// Given, When
		mockMvc.perform(get("/api/help/terms"));

		// Then
		verify(helpService).getTerms();
	}

	@Test
	void 응답은_공통_모양으로_감싼다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/help/terms"))
				.andExpect(jsonPath("$.success").value(true));
	}

	@Test
	void 용어_한_줄에_번호_분류_이름_설명_관련_단어가_담긴다() throws Exception {
		// Given, When, Then
		mockMvc.perform(get("/api/help/terms"))
				.andExpect(jsonPath("$.data[0].helpNo").value(1))
				.andExpect(jsonPath("$.data[0].category").value("금리"))
				.andExpect(jsonPath("$.data[0].title").value("연이율"))
				.andExpect(jsonPath("$.data[0].content").value("한 해 이자 비율"))
				.andExpect(jsonPath("$.data[0].keywords[0]").value("이자"));
	}

	@Test
	void 용어가_없으면_200에_빈_목록이다() throws Exception {
		// Given
		when(helpService.getTerms()).thenReturn(List.of());

		// When, Then
		mockMvc.perform(get("/api/help/terms"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data").isArray())
				.andExpect(jsonPath("$.data").isEmpty());
	}

	// ========== HELP-03 GET /api/help/tips (API-12, 권한: 모두, 응답 = 제목, 요약, 자세히, 키워드) ==========

	private void givenTip() {
		when(helpService.getTips()).thenReturn(
				List.of(new HelpContentResponseDTO(101L, 1, null, "상환 순서", "비싼 빚부터", List.of("상환"), "한 줄 설명", null)));
	}

	@Test
	void TIP은_로그인하지_않아도_200이다() throws Exception {
		// Given (세션 없음)
		givenTip();

		// When, Then
		mockMvc.perform(get("/api/help/tips"))
				.andExpect(status().isOk());
	}

	@Test
	void Service에서_TIP_목록을_가져온다() throws Exception {
		// Given
		givenTip();

		// When
		mockMvc.perform(get("/api/help/tips"));

		// Then
		verify(helpService).getTips();
	}

	@Test
	void TIP_응답은_공통_모양으로_감싼다() throws Exception {
		// Given
		givenTip();

		// When, Then
		mockMvc.perform(get("/api/help/tips"))
				.andExpect(jsonPath("$.success").value(true));
	}

	@Test
	void TIP_한_줄에_제목_요약_자세히_키워드가_담긴다() throws Exception {
		// Given
		givenTip();

		// When, Then
		mockMvc.perform(get("/api/help/tips"))
				.andExpect(jsonPath("$.data[0].title").value("상환 순서"))
				.andExpect(jsonPath("$.data[0].summary").value("한 줄 설명"))
				.andExpect(jsonPath("$.data[0].content").value("비싼 빚부터"))
				.andExpect(jsonPath("$.data[0].keywords[0]").value("상환"));
	}

	@Test
	void TIP이_없으면_200에_빈_목록이다() throws Exception {
		// Given
		when(helpService.getTips()).thenReturn(List.of());

		// When, Then
		mockMvc.perform(get("/api/help/tips"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data").isArray())
				.andExpect(jsonPath("$.data").isEmpty());
	}

	// ========== HELP-01 GET /api/help/faqs (API-11, 권한: 모두, 응답 = helpNo, 분류, 질문, 답, 연 횟수) ==========

	private void givenFaq() {
		when(helpService.getFaqs()).thenReturn(
				List.of(new HelpContentResponseDTO(203L, 3, "사이트 이용", "가입하는 법", "카카오로 가입", null, null, 7)));
	}

	@Test
	void FAQ는_로그인하지_않아도_200이다() throws Exception {
		// Given (세션 없음)
		givenFaq();

		// When, Then
		mockMvc.perform(get("/api/help/faqs"))
				.andExpect(status().isOk());
	}

	@Test
	void Service에서_FAQ_목록을_가져온다() throws Exception {
		// Given
		givenFaq();

		// When
		mockMvc.perform(get("/api/help/faqs"));

		// Then
		verify(helpService).getFaqs();
	}

	@Test
	void FAQ_한_줄에_번호_분류_질문_답_연_횟수가_담긴다() throws Exception {
		// Given
		givenFaq();

		// When, Then
		mockMvc.perform(get("/api/help/faqs"))
				.andExpect(jsonPath("$.data[0].helpId").value(203))
				.andExpect(jsonPath("$.data[0].helpNo").value(3))
				.andExpect(jsonPath("$.data[0].category").value("사이트 이용"))
				.andExpect(jsonPath("$.data[0].title").value("가입하는 법"))
				.andExpect(jsonPath("$.data[0].content").value("카카오로 가입"))
				.andExpect(jsonPath("$.data[0].openCount").value(7));
	}

	@Test
	void FAQ가_없으면_200에_빈_목록이다() throws Exception {
		// Given
		when(helpService.getFaqs()).thenReturn(List.of());

		// When, Then
		mockMvc.perform(get("/api/help/faqs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.data").isArray())
				.andExpect(jsonPath("$.data").isEmpty());
	}

	// ========== HELP-01 POST /api/help/faqs/{id}/open (204, 권한: 모두, 반복 429) ==========

	// 429 확인용: 진짜 RequestLimiter (같은 사람 1분 10회, B10)
	private MockMvc mockMvcWithRealLimiter() {
		return MockMvcBuilders.standaloneSetup(new HelpController(helpService, new RequestLimiter()))
				.setControllerAdvice(new GlobalExceptionHandler())
				.build();
	}

	@Test
	void 열기는_로그인하지_않아도_204이다() throws Exception {
		// Given (세션 없음), When, Then
		mockMvc.perform(post("/api/help/faqs/203/open"))
				.andExpect(status().isNoContent());
	}

	@Test
	void 주소의_번호로_Service를_부른다() throws Exception {
		// Given, When
		mockMvc.perform(post("/api/help/faqs/203/open"));

		// Then
		verify(helpService).openFaq(203L);
	}

	@Test
	void 없는_번호를_열면_404이다() throws Exception {
		// Given
		doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(helpService).openFaq(999L);

		// When, Then
		mockMvc.perform(post("/api/help/faqs/999/open"))
				.andExpect(status().isNotFound());
	}

	@Test
	void 일_분에_열한_번째_열기는_429이다() throws Exception {
		// Given
		MockMvc limited = mockMvcWithRealLimiter();
		for (int i = 0; i < 10; i++) {
			limited.perform(post("/api/help/faqs/203/open"));
		}

		// When, Then
		limited.perform(post("/api/help/faqs/203/open"))
				.andExpect(status().isTooManyRequests());
	}

	@Test
	void 제한에_걸린_요청은_횟수를_올리지_않는다() throws Exception {
		// Given
		MockMvc limited = mockMvcWithRealLimiter();

		// When
		for (int i = 0; i < 11; i++) {
			limited.perform(post("/api/help/faqs/203/open"));
		}

		// Then
		verify(helpService, times(10)).openFaq(203L);
	}
}
