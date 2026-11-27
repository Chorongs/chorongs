package chorong.help.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.isNull;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.util.RequestLimiter;
import chorong.help.dto.FeedbackRequestDTO;
import chorong.help.dto.HelpContentResponseDTO;
import chorong.help.dto.QuestionRequestDTO;
import chorong.help.dto.TermAddRequestDTO;
import chorong.help.entity.HelpType;
import chorong.help.entity.Vote;
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
				List.of(new HelpContentResponseDTO(203L, 3, "사이트 이용", "가입하는 법", "카카오로 가입", null, null, 7L)));
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

	// ========== HELP-07 POST /api/help/term-requests (word 30자, 204, 권한: 모두, 길이 400, 반복 429) ==========
	// 입력 검사 기대값: be_common.md B2 (표시 + @Valid, 실패 400 INVALID_INPUT)

	private static String body(String word) {
		return "{\"word\":\"" + word + "\"}";
	}

	private static MockHttpServletRequestBuilder termRequest(String json) {
		return post("/api/help/term-requests").contentType(MediaType.APPLICATION_JSON).content(json);
	}

	@Test
	void 용어_요청은_로그인하지_않아도_204이다() throws Exception {
		// Given (세션 없음), When, Then
		mockMvc.perform(termRequest(body("DSR")))
				.andExpect(status().isNoContent());
	}

	@Test
	void 보낸_단어를_Service에_넘긴다() throws Exception {
		// Given, When
		mockMvc.perform(termRequest(body("DSR")));

		// Then
		verify(helpService).addTermRequest(new TermAddRequestDTO("DSR"));
	}

	@Test
	void 단어가_없으면_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(termRequest("{}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 단어가_빈_글자면_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(termRequest(body("")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 단어가_공백뿐이면_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(termRequest(body("   ")))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 단어가_31자면_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(termRequest(body("가".repeat(31))))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 입력_검사에_걸리면_Service를_부르지_않는다() throws Exception {
		// Given, When
		mockMvc.perform(termRequest(body("가".repeat(31))));

		// Then
		verify(helpService, never()).addTermRequest(any(TermAddRequestDTO.class));
	}

	@Test
	void 단어가_30자면_204이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(termRequest(body("가".repeat(30))))
				.andExpect(status().isNoContent());
	}

	@Test
	void 일_분에_열한_번째_용어_요청은_429이다() throws Exception {
		// Given
		MockMvc limited = mockMvcWithRealLimiter();
		for (int i = 0; i < 10; i++) {
			limited.perform(termRequest(body("DSR")));
		}

		// When, Then
		limited.perform(termRequest(body("DSR")))
				.andExpect(status().isTooManyRequests());
	}

	// ========== HELP-05 POST /api/help/questions (content 4~300자, 201, 권한: 모두, 길이 400, 반복 429) ==========
	// 길이 4~300자 확인은 공백 제거 후라 Service 테스트에서 확인

	private static MockHttpServletRequestBuilder question(String json) {
		return post("/api/help/questions").contentType(MediaType.APPLICATION_JSON).content(json);
	}

	private static final String QUESTION_JSON = "{\"content\":\"질문 있어요\"}";

	@Test
	void 질문은_로그인하지_않아도_201이다() throws Exception {
		// Given (세션 없음), When, Then
		mockMvc.perform(question(QUESTION_JSON))
				.andExpect(status().isCreated());
	}

	@Test
	void 비회원은_세션_없이_Service를_부른다() throws Exception {
		// Given, When
		mockMvc.perform(question(QUESTION_JSON));

		// Then
		verify(helpService).addQuestion(eq(new QuestionRequestDTO("질문 있어요")), isNull());
	}

	@Test
	void 질문이_없으면_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(question("{}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 질문이_공백뿐이면_400이다() throws Exception {
		// Given, When, Then
		mockMvc.perform(question("{\"content\":\"      \"}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void Service가_길이_오류를_알리면_400이다() throws Exception {
		// Given
		doThrow(new BusinessException(ErrorCode.INVALID_INPUT)).when(helpService)
				.addQuestion(any(), isNull());

		// When, Then
		mockMvc.perform(question(QUESTION_JSON))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 일_분에_열한_번째_질문은_429이다() throws Exception {
		// Given
		MockMvc limited = mockMvcWithRealLimiter();
		for (int i = 0; i < 10; i++) {
			limited.perform(question(QUESTION_JSON));
		}

		// When, Then
		limited.perform(question(QUESTION_JSON))
				.andExpect(status().isTooManyRequests());
	}

	// ========== HELP-06 POST /api/help/feedback (204, 권한: 모두, 반복 429) ==========
	// 입력 검사 기대값: be_common.md B2, 코드 값 타입 (빠진 값, 모르는 코드는 400)

	private static MockHttpServletRequestBuilder feedbackRequest(String json) {
		return post("/api/help/feedback").contentType(MediaType.APPLICATION_JSON).content(json);
	}

	private static final String FEEDBACK_JSON =
			"{\"type\":\"FAQ\",\"targetKey\":201,\"vote\":\"UP\",\"cancel\":false}";

	private void expectBadFeedback(String json) throws Exception {
		mockMvc.perform(feedbackRequest(json))
				.andExpect(status().isBadRequest());
	}

	@Test
	void 평가는_로그인하지_않아도_204이다() throws Exception {
		// Given (세션 없음), When, Then
		mockMvc.perform(feedbackRequest(FEEDBACK_JSON))
				.andExpect(status().isNoContent());
	}

	@Test
	void 보낸_평가_값을_Service에_넘긴다() throws Exception {
		// Given, When
		mockMvc.perform(feedbackRequest(FEEDBACK_JSON));

		// Then
		verify(helpService).addFeedback(new FeedbackRequestDTO(HelpType.FAQ, 201L, Vote.UP, false));
	}

	@Test
	void cancel이_없어도_204이다() throws Exception {
		// Given, When, Then (없는 cancel을 취소 아님으로 처리하는지는 Service 테스트에서 확인)
		mockMvc.perform(feedbackRequest("{\"type\":\"FAQ\",\"targetKey\":201,\"vote\":\"UP\"}"))
				.andExpect(status().isNoContent());
	}

	@Test
	void 평가_종류가_없으면_400이다() throws Exception {
		// Given, When, Then
		expectBadFeedback("{\"targetKey\":201,\"vote\":\"UP\"}");
	}

	@Test
	void 평가_대상_번호가_없으면_400이다() throws Exception {
		// Given, When, Then
		expectBadFeedback("{\"type\":\"FAQ\",\"vote\":\"UP\"}");
	}

	@Test
	void 평가_값이_없으면_400이다() throws Exception {
		// Given, When, Then
		expectBadFeedback("{\"type\":\"FAQ\",\"targetKey\":201}");
	}

	@Test
	void 모르는_평가_종류는_400이다() throws Exception {
		// Given, When, Then
		expectBadFeedback("{\"type\":\"NOTICE\",\"targetKey\":201,\"vote\":\"UP\"}");
	}

	@Test
	void 모르는_평가_값은_400이다() throws Exception {
		// Given, When, Then
		expectBadFeedback("{\"type\":\"FAQ\",\"targetKey\":201,\"vote\":\"MAYBE\"}");
	}

	@Test
	void 일_분에_열한_번째_평가는_429이다() throws Exception {
		// Given
		MockMvc limited = mockMvcWithRealLimiter();
		for (int i = 0; i < 10; i++) {
			limited.perform(feedbackRequest(FEEDBACK_JSON));
		}

		// When, Then
		limited.perform(feedbackRequest(FEEDBACK_JSON))
				.andExpect(status().isTooManyRequests());
	}
}
