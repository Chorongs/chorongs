package chorong.calculator.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import chorong.calculator.dto.CalcHistoryRequestDTO;
import chorong.calculator.dto.CalcHistoryResponseDTO;
import chorong.calculator.entity.CalcHistory;
import chorong.calculator.entity.PrepayMode;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.CalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * CalcHistoryServiceImpl 테스트 (CAL-04)
 * 값 범위 B2, 남의 기록 삭제 차단 B3, 회원당 10개
 */
class CalcHistoryServiceImplTest {

	private static final Long MEMBER_ID = 1L;
	private static final Long OTHER_MEMBER_ID = 2L;

	private CalcHistoryRepository calcHistoryRepository;
	private CalcHistoryServiceImpl calcHistoryService;

	@BeforeEach
	void setUp() {
		calcHistoryRepository = mock(CalcHistoryRepository.class);
		calcHistoryService = new CalcHistoryServiceImpl(calcHistoryRepository);
	}

	// ---- 테스트 데이터 ----

	private static CalcHistoryRequestDTO request(int loanMonths) {
		return new CalcHistoryRequestDTO(10000000L, loanMonths, new BigDecimal("4.5"), RepayMethod.EQUAL_PI, 0,
				1234567L, 860000L, null, null, null, null, null, null, null);
	}

	/** 중도상환 4칸을 모두 채운 요청 (6회차, 300만원, 수수료율 1.2%, 월 납입액 줄이기) */
	private static CalcHistoryRequestDTO prepayRequest(int loanMonths) {
		CalcHistoryRequestDTO request = request(loanMonths);
		request.setPrepayRound(6);
		request.setPrepayAmount(3000000L);
		request.setPrepayFeeRate(new BigDecimal("1.2"));
		request.setPrepayMode(PrepayMode.REDUCE_PAYMENT);
		return request;
	}

	private CalcHistory saved() {
		ArgumentCaptor<CalcHistory> captor = ArgumentCaptor.forClass(CalcHistory.class);
		verify(calcHistoryRepository).save(captor.capture());
		return captor.getValue();
	}

	private void assertRejected(CalcHistoryRequestDTO request) {
		BusinessException e = assertThrows(BusinessException.class, () -> calcHistoryService.saveCalc(MEMBER_ID, request));
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	private static CalcHistory calc(long calcId, long memberId) {
		return CalcHistory.builder()
				.calcId(calcId)
				.memberId(memberId)
				.loanAmount(10000000L)
				.loanMonths(36)
				.interestRate(new BigDecimal("4.50"))
				.repayMethod(RepayMethod.EQUAL_PI)
				.graceMonths(0)
				.totalInterest(1234567L)
				.firstPayment(860000L)
				.calcAt(LocalDateTime.of(2026, 11, 20, 10, 30))
				.build();
	}

	/** 최신 번호가 앞에 오는 기록 n개 (번호 n ~ 1) */
	private static List<CalcHistory> calcs(int count) {
		List<CalcHistory> list = new ArrayList<>();
		for (int i = count; i >= 1; i--) {
			list.add(calc(i, MEMBER_ID));
		}
		return list;
	}

	// ---- 저장 ----

	@Test
	void 허용한_기간이면_저장한다() {
		// Given
		when(calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request(36));

		// Then
		ArgumentCaptor<CalcHistory> captor = ArgumentCaptor.forClass(CalcHistory.class);
		verify(calcHistoryRepository).save(captor.capture());
		assertEquals(MEMBER_ID, captor.getValue().getMemberId());
	}

	@Test
	void 목록에_없는_기간이면_400이고_저장하지_않는다() {
		// Given
		CalcHistoryRequestDTO request = request(24);

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> calcHistoryService.saveCalc(MEMBER_ID, request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
		verify(calcHistoryRepository, never()).save(any());
	}

	@Test
	void 금리는_소수_2자리로_저장한다() {
		// Given
		CalcHistoryRequestDTO request = request(36);
		request.setInterestRate(new BigDecimal("4.567"));
		when(calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request);

		// Then
		ArgumentCaptor<CalcHistory> captor = ArgumentCaptor.forClass(CalcHistory.class);
		verify(calcHistoryRepository).save(captor.capture());
		assertEquals(new BigDecimal("4.57"), captor.getValue().getInterestRate());
	}

	// ---- 칸 사이 규칙: 거치, 만기일시 ----

	@Test
	void 거치_기간이_대출_기간_이상이면_400이고_저장하지_않는다() {
		// Given
		CalcHistoryRequestDTO request = request(12);
		request.setGraceMonths(12);

		// When, Then
		assertRejected(request);
		verify(calcHistoryRepository, never()).save(any());
	}

	@Test
	void 거치_기간이_대출_기간보다_짧으면_저장한다() {
		// Given
		CalcHistoryRequestDTO request = request(12);
		request.setGraceMonths(11);

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request);

		// Then
		assertEquals(11, saved().getGraceMonths());
	}

	@Test
	void 만기일시에_거치_기간이_있으면_400() {
		// Given
		CalcHistoryRequestDTO request = request(36);
		request.setRepayMethod(RepayMethod.BULLET);
		request.setGraceMonths(3);

		// When, Then
		assertRejected(request);
	}

	// ---- 칸 사이 규칙: 체증식 증가율 ----

	@Test
	void 체증식이_아닌데_증가율이_있으면_400() {
		// Given
		CalcHistoryRequestDTO request = request(36);
		request.setGrowthRate(new BigDecimal("5"));

		// When, Then
		assertRejected(request);
	}

	@Test
	void 체증식_증가율은_소수_2자리로_저장한다() {
		// Given
		CalcHistoryRequestDTO request = request(36);
		request.setRepayMethod(RepayMethod.GRADUATED);
		request.setGrowthRate(new BigDecimal("8.555"));

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request);

		// Then
		assertEquals(new BigDecimal("8.56"), saved().getGrowthRate());
	}

	// ---- 칸 사이 규칙: 중도상환 ----

	@Test
	void 중도상환이_일부만_있으면_400() {
		// Given: 회차와 금액만 있고 수수료율, 방식이 없음
		CalcHistoryRequestDTO request = request(36);
		request.setPrepayRound(6);
		request.setPrepayAmount(3000000L);

		// When, Then
		assertRejected(request);
	}

	@Test
	void 중도상환_회차가_대출_기간을_넘으면_400() {
		// Given
		CalcHistoryRequestDTO request = prepayRequest(12);
		request.setPrepayRound(13);

		// When, Then
		assertRejected(request);
	}

	@Test
	void 중도상환_금액을_저장한다() {
		// Given
		CalcHistoryRequestDTO request = prepayRequest(36);

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request);

		// Then
		assertEquals(3000000L, saved().getPrepayAmount());
	}

	@Test
	void 중도상환_방식을_저장한다() {
		// Given
		CalcHistoryRequestDTO request = prepayRequest(36);
		request.setPrepayMode(PrepayMode.SHORTEN_TERM);

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request);

		// Then
		assertEquals(PrepayMode.SHORTEN_TERM, saved().getPrepayMode());
	}

	// ---- 칸 사이 규칙: 금리 변동 ----

	@Test
	void 금리_변동이_일부만_있으면_400() {
		// Given: 회차만 있고 변동 후 금리가 없음
		CalcHistoryRequestDTO request = request(36);
		request.setChangeRound(12);

		// When, Then
		assertRejected(request);
	}

	@Test
	void 금리_변동_회차가_대출_기간을_넘으면_400() {
		// Given
		CalcHistoryRequestDTO request = request(12);
		request.setChangeRound(13);
		request.setChangeRate(new BigDecimal("7.5"));

		// When, Then
		assertRejected(request);
	}

	@Test
	void 변동_후_금리는_소수_2자리로_저장한다() {
		// Given
		CalcHistoryRequestDTO request = request(36);
		request.setChangeRound(12);
		request.setChangeRate(new BigDecimal("7.555"));

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request);

		// Then
		assertEquals(new BigDecimal("7.56"), saved().getChangeRate());
	}

	@Test
	void 옵션을_안_쓰면_옵션_칸은_null로_저장한다() {
		// Given
		CalcHistoryRequestDTO request = request(36);

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request);

		// Then
		assertNull(saved().getPrepayRound());
	}

	@Test
	void 기록이_10개_이하면_삭제하지_않는다() {
		// Given
		when(calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(MEMBER_ID)).thenReturn(calcs(10));

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request(36));

		// Then
		verify(calcHistoryRepository, never()).deleteAll(anyList());
	}

	@Test
	void 기록이_11개가_되면_가장_오래된_1개를_삭제한다() {
		// Given
		when(calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(MEMBER_ID)).thenReturn(calcs(11));

		// When
		calcHistoryService.saveCalc(MEMBER_ID, request(36));

		// Then
		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<CalcHistory>> captor = ArgumentCaptor.forClass(List.class);
		verify(calcHistoryRepository).deleteAll(captor.capture());
		assertEquals(1, captor.getValue().size());
		assertEquals(1L, captor.getValue().get(0).getCalcId());
	}

	// ---- 목록 ----

	@Test
	void 목록은_내_기록만_응답으로_바꿔_돌려준다() {
		// Given
		when(calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(MEMBER_ID)).thenReturn(calcs(2));

		// When
		CalcHistoryResponseDTO response = calcHistoryService.getCalcs(MEMBER_ID);

		// Then
		assertEquals(2, response.getItems().size());
		assertEquals(2L, response.getItems().get(0).getCalcId());
		assertEquals(RepayMethod.EQUAL_PI, response.getItems().get(0).getRepayMethod());
	}

	@Test
	void 목록은_옵션_칸도_돌려준다() {
		// Given
		CalcHistory withPrepay = CalcHistory.builder()
				.calcId(7L)
				.memberId(MEMBER_ID)
				.loanAmount(10000000L)
				.loanMonths(36)
				.interestRate(new BigDecimal("4.50"))
				.repayMethod(RepayMethod.EQUAL_PI)
				.graceMonths(0)
				.totalInterest(1234567L)
				.firstPayment(860000L)
				.prepayRound(6)
				.prepayAmount(3000000L)
				.prepayFeeRate(new BigDecimal("1.20"))
				.prepayMode(PrepayMode.SHORTEN_TERM)
				.calcAt(LocalDateTime.of(2026, 11, 20, 10, 30))
				.build();
		when(calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(MEMBER_ID)).thenReturn(List.of(withPrepay));

		// When
		CalcHistoryResponseDTO response = calcHistoryService.getCalcs(MEMBER_ID);

		// Then
		assertEquals(PrepayMode.SHORTEN_TERM, response.getItems().get(0).getPrepayMode());
	}

	// ---- 삭제 ----

	@Test
	void 내_기록_1건을_삭제한다() {
		// Given
		CalcHistory mine = calc(5L, MEMBER_ID);
		when(calcHistoryRepository.findByCalcIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.of(mine));

		// When
		calcHistoryService.deleteCalc(MEMBER_ID, 5L);

		// Then
		verify(calcHistoryRepository).delete(mine);
	}

	@Test
	void 남의_기록을_삭제하면_404이고_삭제하지_않는다() {
		// Given: 5번 기록은 다른 회원 것이라 '내 기록 조건'에 안 걸림
		when(calcHistoryRepository.findByCalcIdAndMemberId(5L, OTHER_MEMBER_ID)).thenReturn(Optional.of(calc(5L, OTHER_MEMBER_ID)));
		when(calcHistoryRepository.findByCalcIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.empty());

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> calcHistoryService.deleteCalc(MEMBER_ID, 5L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
		verify(calcHistoryRepository, never()).delete(any(CalcHistory.class));
	}

	@Test
	void 없는_기록을_삭제하면_404() {
		// Given
		when(calcHistoryRepository.findByCalcIdAndMemberId(99L, MEMBER_ID)).thenReturn(Optional.empty());

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> calcHistoryService.deleteCalc(MEMBER_ID, 99L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 전체_삭제는_내_회원_번호로만_지운다() {
		// Given, When
		calcHistoryService.deleteCalcs(MEMBER_ID);

		// Then
		verify(calcHistoryRepository).deleteByMemberId(MEMBER_ID);
	}
}
