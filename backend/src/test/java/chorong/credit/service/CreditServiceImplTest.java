package chorong.credit.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import chorong.common.client.FastApiClient;
import chorong.common.dto.FastApiScoreRequestDTO;
import chorong.common.dto.FastApiScoreResponseDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.credit.dto.CreditCheckRequestDTO;
import chorong.credit.dto.CreditCheckResponseDTO;
import chorong.credit.entity.CreditBand;

/*
 * 신용 셀프 진단 (CREDIT-01) 테스트
 * 점수 계산은 FastAPI 몫이라 가짜 FastApiClient (Mockito)를 씀
 */
class CreditServiceImplTest {

	private FastApiClient fastApiClient;
	private CreditServiceImpl creditService;

	@BeforeEach
	void setUp() {
		fastApiClient = mock(FastApiClient.class);
		creditService = new CreditServiceImpl(fastApiClient);
	}

	// ---- 요청, 응답 만들기 도우미 ----

	/** 문항 1~10 답 (문항 5 포함). 보기 번호 10개 + 문항 5 목록 */
	private CreditCheckRequestDTO request(int q1, int q2, int q3, int q4, List<Integer> q5,
										  int q6, int q7, int q8, int q9, int q10) {
		List<CreditCheckRequestDTO.AnswerItem> answers = new ArrayList<>();
		answers.add(answer(1, q1));
		answers.add(answer(2, q2));
		answers.add(answer(3, q3));
		answers.add(answer(4, q4));
		answers.add(new CreditCheckRequestDTO.AnswerItem(5, q5));
		answers.add(answer(6, q6));
		answers.add(answer(7, q7));
		answers.add(answer(8, q8));
		answers.add(answer(9, q9));
		answers.add(answer(10, q10));
		return new CreditCheckRequestDTO(answers);
	}

	private CreditCheckRequestDTO.AnswerItem answer(int questionNo, int choice) {
		return new CreditCheckRequestDTO.AnswerItem(questionNo, List.of(choice));
	}

	/** 정상 답: 문항 5는 은행 */
	private CreditCheckRequestDTO validRequest() {
		return request(1, 1, 1, 2, List.of(1), 2, 2, 1, 1, 4);
	}

	/** 문항 1~10 모두 같은 점수를 돌려주는 FastAPI 응답 */
	private FastApiScoreResponseDTO scoreResponse(int score, int itemScore) {
		List<FastApiScoreResponseDTO.ItemScoreItem> items = new ArrayList<>();
		for (int questionNo = 1; questionNo <= 10; questionNo++) {
			items.add(new FastApiScoreResponseDTO.ItemScoreItem(questionNo, itemScore));
		}
		return new FastApiScoreResponseDTO(score, items);
	}

	private void assertInvalidInput(CreditCheckRequestDTO request) {
		BusinessException e = assertThrows(BusinessException.class, () -> creditService.checkCredit(request));
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
		verifyNoInteractions(fastApiClient);	// 값이 틀리면 FastAPI를 부르지 않음
	}

	// ---- 정상 ----

	@Test
	void 점수에_맞는_구간을_돌려준다() {
		// Given
		when(fastApiClient.scoreCredit(any())).thenReturn(scoreResponse(850, 100));

		// When
		CreditCheckResponseDTO response = creditService.checkCredit(validRequest());

		// Then
		assertEquals(CreditBand.BAND2, response.getCreditBand());
	}

	@Test
	void 문항_10개의_상태와_팁을_순서대로_돌려준다() {
		// Given
		when(fastApiClient.scoreCredit(any())).thenReturn(scoreResponse(850, 100));

		// When
		CreditCheckResponseDTO response = creditService.checkCredit(validRequest());

		// Then
		assertEquals(10, response.getItems().size());
		assertEquals(1, response.getItems().get(0).getQuestionNo());
		assertEquals(10, response.getItems().get(9).getQuestionNo());
	}

	@Test
	void 문항별_점수가_낮으면_주의_높으면_양호() {
		// Given: 문항 1은 10점(주의), 나머지는 100점(양호)
		FastApiScoreResponseDTO scores = scoreResponse(500, 100);
		scores.getItemScores().get(0).setScore(10);
		when(fastApiClient.scoreCredit(any())).thenReturn(scores);

		// When
		CreditCheckResponseDTO response = creditService.checkCredit(validRequest());

		// Then
		assertEquals("주의", response.getItems().get(0).getStatus());
		assertEquals("양호", response.getItems().get(1).getStatus());
	}

	@Test
	void 문항_4_5_6은_점수와_상관없이_고른_보기로_참고_상태를_정한다() {
		// Given: FastAPI 점수는 0이지만 대출 4건 이상(문항 4), 대부업(문항 5), 1억원 이상(문항 6)
		FastApiScoreResponseDTO scores = scoreResponse(500, 100);
		scores.getItemScores().get(3).setScore(0);
		scores.getItemScores().get(4).setScore(0);
		scores.getItemScores().get(5).setScore(0);
		when(fastApiClient.scoreCredit(any())).thenReturn(scores);
		CreditCheckRequestDTO request = request(1, 1, 1, 4, List.of(1, 4), 6, 2, 1, 1, 4);

		// When
		CreditCheckResponseDTO response = creditService.checkCredit(request);

		// Then
		assertEquals("참고: 주의", response.getItems().get(3).getStatus());
		assertEquals("참고: 주의", response.getItems().get(4).getStatus());
		assertEquals("참고: 주의", response.getItems().get(5).getStatus());
	}

	// ---- 문항 5 ----

	@Test
	void 문항_5가_없어도_빈_목록으로_FastAPI에_보낸다() {
		// Given: 문항 5를 뺀 9문항
		when(fastApiClient.scoreCredit(any())).thenReturn(scoreResponse(850, 100));
		CreditCheckRequestDTO request = validRequest();
		request.getAnswers().removeIf(a -> a.getQuestionNo() == 5);

		// When
		creditService.checkCredit(request);

		// Then
		ArgumentCaptor<FastApiScoreRequestDTO> captor = ArgumentCaptor.forClass(FastApiScoreRequestDTO.class);
		verify(fastApiClient).scoreCredit(captor.capture());
		FastApiScoreRequestDTO sent = captor.getValue();
		assertEquals(10, sent.getAnswers().size());
		assertEquals(List.of(), sent.getAnswers().get(4).getChoices());
	}

	@Test
	void 문항_5는_여러_개를_고를_수_있다() {
		// Given
		when(fastApiClient.scoreCredit(any())).thenReturn(scoreResponse(850, 100));
		CreditCheckRequestDTO request = request(1, 1, 1, 2, List.of(1, 2, 3), 2, 2, 1, 1, 4);

		// When
		CreditCheckResponseDTO response = creditService.checkCredit(request);

		// Then
		assertEquals("참고: 보통", response.getItems().get(4).getStatus());	// 저축은행·상호금융(3)이 가장 위험
	}

	@Test
	void 문항_5에_같은_번호를_두_번_보내면_400() {
		assertInvalidInput(request(1, 1, 1, 2, List.of(1, 1), 2, 2, 1, 1, 4));
	}

	@Test
	void 문항_5에_모르는_보기_번호가_있으면_400() {
		assertInvalidInput(request(1, 1, 1, 2, List.of(5), 2, 2, 1, 1, 4));
	}

	// ---- 잘 모르겠어요 ----

	@Test
	void 잘_모르겠어요가_있으면_정확도_낮음_true() {
		// Given: 문항 7 = 0 (잘 모르겠어요)
		when(fastApiClient.scoreCredit(any())).thenReturn(scoreResponse(850, 100));
		CreditCheckRequestDTO request = request(1, 1, 1, 2, List.of(1), 2, 0, 1, 1, 4);

		// When
		CreditCheckResponseDTO response = creditService.checkCredit(request);

		// Then
		assertTrue(response.isLowAccuracy());
	}

	@Test
	void 잘_모르겠어요가_없으면_정확도_낮음_false() {
		// Given
		when(fastApiClient.scoreCredit(any())).thenReturn(scoreResponse(850, 100));

		// When
		CreditCheckResponseDTO response = creditService.checkCredit(validRequest());

		// Then
		assertFalse(response.isLowAccuracy());
	}

	@Test
	void 잘_모르겠어요_문항은_확인_필요로_표시한다() {
		// Given: 문항 7 = 0
		when(fastApiClient.scoreCredit(any())).thenReturn(scoreResponse(850, 100));
		CreditCheckRequestDTO request = request(1, 1, 1, 2, List.of(1), 2, 0, 1, 1, 4);

		// When
		CreditCheckResponseDTO response = creditService.checkCredit(request);

		// Then
		assertEquals("확인 필요", response.getItems().get(6).getStatus());
	}

	@Test
	void 잘_모르겠어요를_받지_않는_문항에_0을_보내면_400() {
		// 문항 1 = 0 (연체 문항은 모르겠어요 없음)
		assertInvalidInput(request(0, 1, 1, 2, List.of(1), 2, 2, 1, 1, 4));
	}

	// ---- 값 확인 (B2) ----

	@Test
	void 문항의_보기_번호_범위를_넘으면_400() {
		// 문항 3은 보기가 2개 (없음, 있음)
		assertInvalidInput(request(1, 1, 3, 2, List.of(1), 2, 2, 1, 1, 4));
	}

	@Test
	void 음수_보기_번호는_400() {
		assertInvalidInput(request(1, 1, 1, 2, List.of(1), 2, -1, 1, 1, 4));
	}

	@Test
	void 문항_5_말고_필수_문항이_빠지면_400() {
		// Given: 문항 1을 뺀 9문항
		CreditCheckRequestDTO request = validRequest();
		request.getAnswers().removeIf(a -> a.getQuestionNo() == 1);

		// When, Then
		assertInvalidInput(request);
	}

	@Test
	void 같은_문항을_두_번_보내면_400() {
		// Given
		CreditCheckRequestDTO request = validRequest();
		request.getAnswers().add(answer(1, 2));

		// When, Then
		assertInvalidInput(request);
	}

	@Test
	void 없는_문항_번호는_400() {
		// Given
		CreditCheckRequestDTO request = validRequest();
		request.getAnswers().add(answer(11, 1));

		// When, Then
		assertInvalidInput(request);
	}

	@Test
	void 단일_문항에_보기를_여러_개_보내면_400() {
		// Given: 문항 1에 보기 2개
		CreditCheckRequestDTO request = validRequest();
		request.getAnswers().set(0, new CreditCheckRequestDTO.AnswerItem(1, List.of(1, 2)));

		// When, Then
		assertInvalidInput(request);
	}

	@Test
	void 답이_없으면_400() {
		assertInvalidInput(new CreditCheckRequestDTO(null));
	}

	// ---- FastAPI 실패 (B14) ----

	@Test
	void FastAPI가_실패하면_503() {
		// Given
		when(fastApiClient.scoreCredit(any())).thenThrow(new BusinessException(ErrorCode.SERVICE_UNAVAILABLE));

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> creditService.checkCredit(validRequest()));

		// Then
		assertEquals(ErrorCode.SERVICE_UNAVAILABLE, e.getErrorCode());
	}

	@Test
	void FastAPI_점수가_범위를_벗어나면_503() {
		// Given: 점수 1001
		when(fastApiClient.scoreCredit(any())).thenReturn(scoreResponse(1001, 100));

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> creditService.checkCredit(validRequest()));

		// Then
		assertEquals(ErrorCode.SERVICE_UNAVAILABLE, e.getErrorCode());
	}

	@Test
	void FastAPI_문항별_점수가_빠지면_503() {
		// Given: 문항 1 점수 없음
		FastApiScoreResponseDTO scores = scoreResponse(850, 100);
		scores.getItemScores().remove(0);
		when(fastApiClient.scoreCredit(any())).thenReturn(scores);

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> creditService.checkCredit(validRequest()));

		// Then
		assertEquals(ErrorCode.SERVICE_UNAVAILABLE, e.getErrorCode());
	}
}
