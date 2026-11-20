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

import chorong.calculator.dto.CalcHistoryRequestDTO;
import chorong.calculator.dto.CalcHistoryResponseDTO;
import chorong.calculator.entity.CalcHistory;
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
				1234567L, 860000L);
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
