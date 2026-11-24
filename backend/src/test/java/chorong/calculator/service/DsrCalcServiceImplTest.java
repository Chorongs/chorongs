package chorong.calculator.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.inOrder;
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
import org.mockito.InOrder;

import chorong.calculator.dto.DsrCalcRequestDTO;
import chorong.calculator.dto.DsrCalcResponseDTO;
import chorong.calculator.entity.DsrCalcHistory;
import chorong.calculator.entity.DsrLoan;
import chorong.calculator.entity.LoanKind;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.DsrCalcHistoryRepository;
import chorong.calculator.repository.DsrLoanRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * DsrCalcServiceImpl 테스트 (CAL-06)
 * 상환 방식 코드 B2, 남의 기록 삭제 차단 B3, 회원당 10개, 지울 때 대출 행 먼저
 */
class DsrCalcServiceImplTest {

	private static final Long MEMBER_ID = 1L;
	private static final Long OTHER_MEMBER_ID = 2L;

	private DsrCalcHistoryRepository dsrCalcHistoryRepository;
	private DsrLoanRepository dsrLoanRepository;
	private DsrCalcServiceImpl dsrCalcService;

	@BeforeEach
	void setUp() {
		dsrCalcHistoryRepository = mock(DsrCalcHistoryRepository.class);
		dsrLoanRepository = mock(DsrLoanRepository.class);
		dsrCalcService = new DsrCalcServiceImpl(dsrCalcHistoryRepository, dsrLoanRepository);
		// 저장하면 번호 100이 붙은 계산이 돌아옴 (IDENTITY)
		when(dsrCalcHistoryRepository.save(any(DsrCalcHistory.class))).thenReturn(calc(100, MEMBER_ID));
	}

	// ---- 테스트 데이터 ----

	private static DsrCalcRequestDTO.LoanItem loanItem(LoanKind kind, RepayMethod repayMethod, long amount) {
		return new DsrCalcRequestDTO.LoanItem(kind, repayMethod, amount, new BigDecimal("4.5"), 120);
	}

	private static DsrCalcRequestDTO request(List<DsrCalcRequestDTO.LoanItem> loans) {
		return new DsrCalcRequestDTO(60000000L, new BigDecimal("35.5"), 21300000L, loans);
	}

	private static DsrCalcRequestDTO requestWithLoanCount(int count) {
		List<DsrCalcRequestDTO.LoanItem> loans = new ArrayList<>();
		for (int i = 0; i < count; i++) {
			loans.add(loanItem(LoanKind.CREDIT, RepayMethod.EQUAL_PI, 10000000L + i));
		}
		return request(loans);
	}

	private static DsrCalcHistory calc(long dsrId, long memberId) {
		return DsrCalcHistory.builder()
				.dsrId(dsrId)
				.memberId(memberId)
				.annualIncome(60000000L)
				.dsrRate(new BigDecimal("35.50"))
				.yearlyPayment(21300000L)
				.calcAt(LocalDateTime.of(2026, 11, 20, 10, 30))
				.build();
	}

	private static DsrLoan loan(long dsrId, int sortNo) {
		return DsrLoan.builder()
				.dsrLoanId(dsrId * 100 + sortNo)
				.dsrId(dsrId)
				.sortNo(sortNo)
				.loanKind(LoanKind.MORTGAGE)
				.repayMethod(RepayMethod.EQUAL_PI)
				.loanAmount(100000000L + sortNo)
				.interestRate(new BigDecimal("4.50"))
				.loanMonths(360)
				.build();
	}

	/** 최신 번호가 앞에 오는 기록 n개 (번호 n ~ 1) */
	private static List<DsrCalcHistory> calcs(int count) {
		List<DsrCalcHistory> list = new ArrayList<>();
		for (int i = count; i >= 1; i--) {
			list.add(calc(i, MEMBER_ID));
		}
		return list;
	}

	private void assertRejected(DsrCalcRequestDTO request) {
		BusinessException e = assertThrows(BusinessException.class, () -> dsrCalcService.saveDsrCalc(MEMBER_ID, request));
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
		verify(dsrCalcHistoryRepository, never()).save(any());
		verify(dsrLoanRepository, never()).saveAll(anyList());
	}

	// ---- 저장 ----

	@Test
	void 계산_1행을_저장하고_그_번호로_대출_행을_입력_순서대로_저장한다() {
		// Given
		DsrCalcRequestDTO request = request(List.of(
				loanItem(LoanKind.MORTGAGE, RepayMethod.EQUAL_P, 200000000L),
				loanItem(LoanKind.CREDIT, RepayMethod.BULLET, 30000000L),
				loanItem(LoanKind.OTHER, RepayMethod.EQUAL_PI, 5000000L)));
		when(dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		dsrCalcService.saveDsrCalc(MEMBER_ID, request);

		// Then
		ArgumentCaptor<DsrCalcHistory> calcCaptor = ArgumentCaptor.forClass(DsrCalcHistory.class);
		verify(dsrCalcHistoryRepository).save(calcCaptor.capture());
		assertEquals(MEMBER_ID, calcCaptor.getValue().getMemberId());

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<DsrLoan>> loanCaptor = ArgumentCaptor.forClass(List.class);
		verify(dsrLoanRepository).saveAll(loanCaptor.capture());
		List<DsrLoan> loans = loanCaptor.getValue();
		assertEquals(3, loans.size());
		assertEquals(100L, loans.get(0).getDsrId());
		assertEquals(1, loans.get(0).getSortNo());
		assertEquals(LoanKind.MORTGAGE, loans.get(0).getLoanKind());
		assertEquals(2, loans.get(1).getSortNo());
		assertEquals(RepayMethod.BULLET, loans.get(1).getRepayMethod());
		assertEquals(3, loans.get(2).getSortNo());
	}

	@Test
	void 대출이_10건이면_저장한다() {
		// Given
		when(dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		dsrCalcService.saveDsrCalc(MEMBER_ID, requestWithLoanCount(10));

		// Then
		verify(dsrLoanRepository).saveAll(anyList());
	}

	@Test
	void 대출_중_하나라도_체증식이면_400이고_아무것도_저장하지_않는다() {
		// Given
		DsrCalcRequestDTO request = request(List.of(
				loanItem(LoanKind.CREDIT, RepayMethod.EQUAL_PI, 10000000L),
				loanItem(LoanKind.CREDIT, RepayMethod.GRADUATED, 10000000L)));

		// When, Then
		assertRejected(request);
	}

	@Test
	void 대출_금리와_DSR은_소수_2자리로_저장한다() {
		// Given
		DsrCalcRequestDTO request = request(List.of(
				new DsrCalcRequestDTO.LoanItem(LoanKind.CREDIT, RepayMethod.EQUAL_PI, 10000000L, new BigDecimal("4.567"), 12)));
		request.setDsrRate(new BigDecimal("35.555"));
		when(dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		dsrCalcService.saveDsrCalc(MEMBER_ID, request);

		// Then
		ArgumentCaptor<DsrCalcHistory> calcCaptor = ArgumentCaptor.forClass(DsrCalcHistory.class);
		verify(dsrCalcHistoryRepository).save(calcCaptor.capture());
		assertEquals(new BigDecimal("35.56"), calcCaptor.getValue().getDsrRate());

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<DsrLoan>> loanCaptor = ArgumentCaptor.forClass(List.class);
		verify(dsrLoanRepository).saveAll(loanCaptor.capture());
		assertEquals(new BigDecimal("4.57"), loanCaptor.getValue().get(0).getInterestRate());
	}

	// ---- 회원당 10개 ----

	@Test
	void 기록이_10개_이하면_지우지_않는다() {
		// Given
		when(dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(MEMBER_ID)).thenReturn(calcs(10));

		// When
		dsrCalcService.saveDsrCalc(MEMBER_ID, requestWithLoanCount(1));

		// Then
		verify(dsrLoanRepository, never()).deleteByDsrIdIn(anyList());
		verify(dsrCalcHistoryRepository, never()).deleteAll(anyList());
	}

	@Test
	@SuppressWarnings("unchecked")
	void 기록이_11개가_되면_가장_오래된_계산의_대출_행을_먼저_지우고_계산을_지운다() {
		// Given
		when(dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(MEMBER_ID)).thenReturn(calcs(11));

		// When
		dsrCalcService.saveDsrCalc(MEMBER_ID, requestWithLoanCount(2));

		// Then: 대출 행 삭제 -> 계산 삭제 순서
		ArgumentCaptor<List<Long>> loanIdsCaptor = ArgumentCaptor.forClass(List.class);
		ArgumentCaptor<List<DsrCalcHistory>> calcCaptor = ArgumentCaptor.forClass(List.class);
		InOrder order = inOrder(dsrLoanRepository, dsrCalcHistoryRepository);
		order.verify(dsrLoanRepository).deleteByDsrIdIn(loanIdsCaptor.capture());
		order.verify(dsrCalcHistoryRepository).deleteAll(calcCaptor.capture());
		assertEquals(List.of(1L), loanIdsCaptor.getValue());
		assertEquals(1, calcCaptor.getValue().size());
		assertEquals(1L, calcCaptor.getValue().get(0).getDsrId());
	}

	// ---- 목록 ----

	@Test
	void 목록은_계산마다_대출_목록을_입력_순서대로_붙인다() {
		// Given: 계산 2개 (번호 2, 1), 대출 행은 한 번에 읽어 옴
		when(dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(MEMBER_ID)).thenReturn(calcs(2));
		when(dsrLoanRepository.findByDsrIdInOrderByDsrIdAscSortNoAsc(List.of(2L, 1L)))
				.thenReturn(List.of(loan(1, 1), loan(2, 1), loan(2, 2), loan(2, 3)));

		// When
		DsrCalcResponseDTO response = dsrCalcService.getDsrCalcs(MEMBER_ID);

		// Then
		assertEquals(2, response.getItems().size());
		DsrCalcResponseDTO.Item newest = response.getItems().get(0);
		assertEquals(2L, newest.getDsrId());
		assertEquals(3, newest.getLoans().size());
		assertEquals(100000001L, newest.getLoans().get(0).getLoanAmount());
		assertEquals(100000003L, newest.getLoans().get(2).getLoanAmount());
		assertEquals(1, response.getItems().get(1).getLoans().size());
	}

	@Test
	void 기록이_없으면_빈_목록이고_대출_행을_읽지_않는다() {
		// Given
		when(dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(MEMBER_ID)).thenReturn(List.of());

		// When
		DsrCalcResponseDTO response = dsrCalcService.getDsrCalcs(MEMBER_ID);

		// Then
		assertEquals(0, response.getItems().size());
		verify(dsrLoanRepository, never()).findByDsrIdInOrderByDsrIdAscSortNoAsc(anyList());
	}

	// ---- 삭제 (B3, 대출 행 먼저) ----

	@Test
	void 내_기록_1건은_대출_행을_먼저_지우고_계산을_지운다() {
		// Given
		DsrCalcHistory mine = calc(5, MEMBER_ID);
		when(dsrCalcHistoryRepository.findByDsrIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.of(mine));

		// When
		dsrCalcService.deleteDsrCalc(MEMBER_ID, 5L);

		// Then
		InOrder order = inOrder(dsrLoanRepository, dsrCalcHistoryRepository);
		order.verify(dsrLoanRepository).deleteByDsrIdIn(List.of(5L));
		order.verify(dsrCalcHistoryRepository).delete(mine);
	}

	@Test
	void 남의_기록을_지우면_404이고_대출_행도_지우지_않는다() {
		// Given: 5번 기록은 회원 2의 것이라 회원 1 조건으로는 찾아지지 않음
		when(dsrCalcHistoryRepository.findByDsrIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.empty());
		when(dsrCalcHistoryRepository.findByDsrIdAndMemberId(5L, OTHER_MEMBER_ID))
				.thenReturn(Optional.of(calc(5, OTHER_MEMBER_ID)));

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> dsrCalcService.deleteDsrCalc(MEMBER_ID, 5L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
		verify(dsrLoanRepository, never()).deleteByDsrIdIn(anyList());
		verify(dsrCalcHistoryRepository, never()).delete(any());
	}

	@Test
	void 없는_기록을_지워도_같은_404() {
		// Given
		when(dsrCalcHistoryRepository.findByDsrIdAndMemberId(99L, MEMBER_ID)).thenReturn(Optional.empty());

		// When
		BusinessException e = assertThrows(BusinessException.class, () -> dsrCalcService.deleteDsrCalc(MEMBER_ID, 99L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 전체_삭제는_대출_행을_먼저_지우고_계산을_지운다() {
		// Given, When
		dsrCalcService.deleteDsrCalcs(MEMBER_ID);

		// Then
		InOrder order = inOrder(dsrLoanRepository, dsrCalcHistoryRepository);
		order.verify(dsrLoanRepository).deleteByMemberId(MEMBER_ID);
		order.verify(dsrCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
	}
}
