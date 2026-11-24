package chorong.calculator.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

import chorong.calculator.dto.ChangeCalcHistoryRequestDTO;
import chorong.calculator.dto.ChangeCalcHistoryResponseDTO;
import chorong.calculator.entity.ChangeCalcHistory;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.ChangeCalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * ChangeCalcHistoryServiceImpl 테스트 (CAL-05)
 * 상환 방식 코드 B2, 남의 기록 삭제 차단 B3, 회원당 10개
 */
class ChangeCalcHistoryServiceImplTest {

	private static final Long MEMBER_ID = 1L;
	private static final Long OTHER_MEMBER_ID = 2L;

	private ChangeCalcHistoryRepository changeCalcHistoryRepository;
	private ChangeCalcHistoryServiceImpl changeCalcHistoryService;

	@BeforeEach
	void setUp() {
		changeCalcHistoryRepository = mock(ChangeCalcHistoryRepository.class);
		changeCalcHistoryService = new ChangeCalcHistoryServiceImpl(changeCalcHistoryRepository);
	}

	// ---- 테스트 데이터 ----

	private static ChangeCalcHistoryRequestDTO request(RepayMethod current, RepayMethod next) {
		return new ChangeCalcHistoryRequestDTO(current, 100000000L, new BigDecimal("4.5"), 120, next,
				new BigDecimal("3.5"), 120, new BigDecimal("1.2"), 500000L, 1500000L, 800000L, 9000000L);
	}

	private static ChangeCalcHistory calc(long changeId, long memberId) {
		return ChangeCalcHistory.builder()
				.changeId(changeId)
				.memberId(memberId)
				.currentRepayMethod(RepayMethod.EQUAL_PI)
				.currentBalance(100000000L)
				.currentRate(new BigDecimal("4.50"))
				.currentMonths(120)
				.newRepayMethod(RepayMethod.EQUAL_P)
				.newRate(new BigDecimal("3.50"))
				.newMonths(120)
				.feeRate(new BigDecimal("1.20"))
				.etcCost(500000L)
				.savingAmount(-1500000L)
				.newFirstPayment(800000L)
				.newTotalInterest(9000000L)
				.calcAt(LocalDateTime.of(2026, 11, 20, 10, 30))
				.build();
	}

	/** 최신 번호가 앞에 오는 기록 n개 (번호 n ~ 1) */
	private static List<ChangeCalcHistory> calcs(int count) {
		List<ChangeCalcHistory> list = new ArrayList<>();
		for (int i = count; i >= 1; i--) {
			list.add(calc(i, MEMBER_ID));
		}
		return list;
	}

	private void assertRejected(ChangeCalcHistoryRequestDTO request) {
		BusinessException e = assertThrows(BusinessException.class,
				() -> changeCalcHistoryService.saveChangeCalc(MEMBER_ID, request));
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
		verify(changeCalcHistoryRepository, never()).save(any());
	}

	// ---- 저장 ----

	@Test
	void 허용한_상환_방식이면_세션_회원_번호로_저장한다() {
		// Given
		when(changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		changeCalcHistoryService.saveChangeCalc(MEMBER_ID, request(RepayMethod.BULLET, RepayMethod.EQUAL_PI));

		// Then
		ArgumentCaptor<ChangeCalcHistory> captor = ArgumentCaptor.forClass(ChangeCalcHistory.class);
		verify(changeCalcHistoryRepository).save(captor.capture());
		assertEquals(MEMBER_ID, captor.getValue().getMemberId());
		assertEquals(RepayMethod.BULLET, captor.getValue().getCurrentRepayMethod());
	}

	@Test
	void 지금_대출이_체증식이면_400이고_저장하지_않는다() {
		// Given, When, Then
		assertRejected(request(RepayMethod.GRADUATED, RepayMethod.EQUAL_PI));
	}

	@Test
	void 갈아탈_대출이_체증식이면_400이고_저장하지_않는다() {
		// Given, When, Then
		assertRejected(request(RepayMethod.EQUAL_PI, RepayMethod.GRADUATED));
	}

	@Test
	void 금리와_수수료율은_소수_2자리로_저장한다() {
		// Given
		ChangeCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI, RepayMethod.EQUAL_P);
		request.setCurrentRate(new BigDecimal("4.567"));
		request.setNewRate(new BigDecimal("3.451"));
		request.setFeeRate(new BigDecimal("1.205"));
		when(changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		changeCalcHistoryService.saveChangeCalc(MEMBER_ID, request);

		// Then
		ArgumentCaptor<ChangeCalcHistory> captor = ArgumentCaptor.forClass(ChangeCalcHistory.class);
		verify(changeCalcHistoryRepository).save(captor.capture());
		assertEquals(new BigDecimal("4.57"), captor.getValue().getCurrentRate());
		assertEquals(new BigDecimal("3.45"), captor.getValue().getNewRate());
		assertEquals(new BigDecimal("1.21"), captor.getValue().getFeeRate());
	}

	@Test
	void 아끼는_돈이_음수여도_그대로_저장한다() {
		// Given
		ChangeCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI, RepayMethod.EQUAL_P);
		request.setSavingAmount(-2500000L);
		when(changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		changeCalcHistoryService.saveChangeCalc(MEMBER_ID, request);

		// Then
		ArgumentCaptor<ChangeCalcHistory> captor = ArgumentCaptor.forClass(ChangeCalcHistory.class);
		verify(changeCalcHistoryRepository).save(captor.capture());
		assertEquals(-2500000L, captor.getValue().getSavingAmount());
	}

	// ---- 회원당 10개 ----

	@Test
	void 기록이_10개_이하면_지우지_않는다() {
		// Given
		when(changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(MEMBER_ID)).thenReturn(calcs(10));

		// When
		changeCalcHistoryService.saveChangeCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI, RepayMethod.EQUAL_P));

		// Then
		verify(changeCalcHistoryRepository, never()).deleteAll(anyList());
	}

	@Test
	@SuppressWarnings("unchecked")
	void 기록이_11개가_되면_가장_오래된_1개를_지운다() {
		// Given
		when(changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(MEMBER_ID)).thenReturn(calcs(11));

		// When
		changeCalcHistoryService.saveChangeCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI, RepayMethod.EQUAL_P));

		// Then
		ArgumentCaptor<List<ChangeCalcHistory>> captor = ArgumentCaptor.forClass(List.class);
		verify(changeCalcHistoryRepository).deleteAll(captor.capture());
		assertEquals(1, captor.getValue().size());
		assertEquals(1L, captor.getValue().get(0).getChangeId());
	}

	// ---- 목록 ----

	@Test
	void 목록은_최신_기록_순서를_그대로_응답으로_바꾼다() {
		// Given
		when(changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(MEMBER_ID)).thenReturn(calcs(3));

		// When
		ChangeCalcHistoryResponseDTO response = changeCalcHistoryService.getChangeCalcs(MEMBER_ID);

		// Then
		assertEquals(3, response.getItems().size());
		assertEquals(3L, response.getItems().get(0).getChangeId());
		assertEquals(-1500000L, response.getItems().get(0).getSavingAmount());
	}

	// ---- 삭제 (B3) ----

	@Test
	void 내_기록_1건을_지운다() {
		// Given
		ChangeCalcHistory mine = calc(5, MEMBER_ID);
		when(changeCalcHistoryRepository.findByChangeIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.of(mine));

		// When
		changeCalcHistoryService.deleteChangeCalc(MEMBER_ID, 5L);

		// Then
		verify(changeCalcHistoryRepository).delete(mine);
	}

	@Test
	void 남의_기록을_지우면_404이고_지우지_않는다() {
		// Given: 5번 기록은 회원 2의 것이라 회원 1 조건으로는 찾아지지 않음
		when(changeCalcHistoryRepository.findByChangeIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.empty());
		when(changeCalcHistoryRepository.findByChangeIdAndMemberId(5L, OTHER_MEMBER_ID))
				.thenReturn(Optional.of(calc(5, OTHER_MEMBER_ID)));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> changeCalcHistoryService.deleteChangeCalc(MEMBER_ID, 5L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
		verify(changeCalcHistoryRepository, never()).delete(any());
	}

	@Test
	void 없는_기록을_지워도_같은_404() {
		// Given
		when(changeCalcHistoryRepository.findByChangeIdAndMemberId(99L, MEMBER_ID)).thenReturn(Optional.empty());

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> changeCalcHistoryService.deleteChangeCalc(MEMBER_ID, 99L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 전체_삭제는_내_회원_번호로만_부른다() {
		// Given, When
		changeCalcHistoryService.deleteChangeCalcs(MEMBER_ID);

		// Then
		verify(changeCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
	}
}
