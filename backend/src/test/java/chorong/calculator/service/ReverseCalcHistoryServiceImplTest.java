package chorong.calculator.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import org.springframework.beans.BeanUtils;

import chorong.calculator.dto.ReverseCalcHistoryRequestDTO;
import chorong.calculator.dto.ReverseCalcHistoryResponseDTO;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.entity.ReverseCalcHistory;
import chorong.calculator.repository.ReverseCalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.member.entity.Member;
import chorong.member.repository.MemberRepository;

/*
 * ReverseCalcHistoryServiceImpl 테스트 (CAL-07)
 * 상환 방식 코드 B2, 남의 기록 삭제 차단 B3, 회원당 10개
 */
class ReverseCalcHistoryServiceImplTest {

	private static final Long MEMBER_ID = 1L;
	private static final Long OTHER_MEMBER_ID = 2L;

	private ReverseCalcHistoryRepository reverseCalcHistoryRepository;
	private ReverseCalcHistoryServiceImpl reverseCalcHistoryService;
	private MemberRepository memberRepository;

	@BeforeEach
	void setUp() {
		reverseCalcHistoryRepository = mock(ReverseCalcHistoryRepository.class);
		memberRepository = mock(MemberRepository.class);
		// 회원 행 잠금은 늘 회원을 찾음 (B9)
		when(memberRepository.findLockedByMemberId(MEMBER_ID)).thenReturn(Optional.of(BeanUtils.instantiateClass(Member.class)));
		reverseCalcHistoryService = new ReverseCalcHistoryServiceImpl(reverseCalcHistoryRepository, memberRepository);
	}

	// ---- 테스트 데이터 ----

	private static ReverseCalcHistoryRequestDTO request(RepayMethod repayMethod) {
		return new ReverseCalcHistoryRequestDTO(repayMethod, 1000000L, new BigDecimal("4.5"), 360, 197000000L);
	}

	// 이미 저장된 기록 예시: 금액이 request와 달라 같은 기록이 아님 (같은 기록 409를 피해 10개 정리 등을 확인)
	private static ReverseCalcHistory calc(long reverseId, long memberId) {
		return ReverseCalcHistory.builder()
				.reverseId(reverseId)
				.memberId(memberId)
				.repayMethod(RepayMethod.EQUAL_PI)
				.monthlyPayment(2000000L)
				.interestRate(new BigDecimal("4.50"))
				.loanMonths(360)
				.maxLoan(197000000L)
				.calcAt(LocalDateTime.of(2026, 11, 20, 10, 30))
				.build();
	}

	/** 최신 번호가 앞에 오는 기록 n개 (번호 n ~ 1) */
	private static List<ReverseCalcHistory> calcs(int count) {
		List<ReverseCalcHistory> list = new ArrayList<>();
		for (int i = count; i >= 1; i--) {
			list.add(calc(i, MEMBER_ID));
		}
		return list;
	}

	// ---- 저장 ----

	@Test
	void 허용한_상환_방식이면_세션_회원_번호로_저장한다() {
		// Given
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		reverseCalcHistoryService.saveReverseCalc(MEMBER_ID, request(RepayMethod.BULLET));

		// Then
		ArgumentCaptor<ReverseCalcHistory> captor = ArgumentCaptor.forClass(ReverseCalcHistory.class);
		verify(reverseCalcHistoryRepository).save(captor.capture());
		assertEquals(MEMBER_ID, captor.getValue().getMemberId());
		assertEquals(RepayMethod.BULLET, captor.getValue().getRepayMethod());
	}

	@Test
	void 체증식이면_400이고_저장하지_않는다() {
		// Given
		ReverseCalcHistoryRequestDTO request = request(RepayMethod.GRADUATED);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> reverseCalcHistoryService.saveReverseCalc(MEMBER_ID, request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
		verify(reverseCalcHistoryRepository, never()).save(any());
	}

	@Test
	void 금리는_소수_2자리로_저장한다() {
		// Given
		ReverseCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);
		request.setInterestRate(new BigDecimal("4.567"));
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		reverseCalcHistoryService.saveReverseCalc(MEMBER_ID, request);

		// Then
		ArgumentCaptor<ReverseCalcHistory> captor = ArgumentCaptor.forClass(ReverseCalcHistory.class);
		verify(reverseCalcHistoryRepository).save(captor.capture());
		assertEquals(new BigDecimal("4.57"), captor.getValue().getInterestRate());
	}

	// ---- 회원당 10개 ----

	@Test
	void 기록이_10개_이하면_지우지_않는다() {
		// Given
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(calcs(10));

		// When
		reverseCalcHistoryService.saveReverseCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		verify(reverseCalcHistoryRepository, never()).deleteAll(anyList());
	}

	@Test
	@SuppressWarnings("unchecked")
	void 기록이_11개가_되면_가장_오래된_1개를_지운다() {
		// Given
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(calcs(11));

		// When
		reverseCalcHistoryService.saveReverseCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		ArgumentCaptor<List<ReverseCalcHistory>> captor = ArgumentCaptor.forClass(List.class);
		verify(reverseCalcHistoryRepository).deleteAll(captor.capture());
		assertEquals(1, captor.getValue().size());
		assertEquals(1L, captor.getValue().get(0).getReverseId());
	}

	// ---- 목록 ----

	@Test
	void 목록은_최신_기록_순서를_그대로_응답으로_바꾼다() {
		// Given
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(calcs(3));

		// When
		ReverseCalcHistoryResponseDTO response = reverseCalcHistoryService.getReverseCalcs(MEMBER_ID);

		// Then
		assertEquals(3, response.getItems().size());
		assertEquals(3L, response.getItems().get(0).getReverseId());
		assertEquals(197000000L, response.getItems().get(0).getMaxLoan());
	}

	// ---- 삭제 (B3) ----

	@Test
	void 내_기록_1건을_지운다() {
		// Given
		ReverseCalcHistory mine = calc(5, MEMBER_ID);
		when(reverseCalcHistoryRepository.findByReverseIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.of(mine));

		// When
		reverseCalcHistoryService.deleteReverseCalc(MEMBER_ID, 5L);

		// Then
		verify(reverseCalcHistoryRepository).delete(mine);
	}

	@Test
	void 남의_기록을_지우면_404이고_지우지_않는다() {
		// Given: 5번 기록은 회원 2의 것이라 회원 1 조건으로는 찾아지지 않음
		when(reverseCalcHistoryRepository.findByReverseIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.empty());
		when(reverseCalcHistoryRepository.findByReverseIdAndMemberId(5L, OTHER_MEMBER_ID))
				.thenReturn(Optional.of(calc(5, OTHER_MEMBER_ID)));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> reverseCalcHistoryService.deleteReverseCalc(MEMBER_ID, 5L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
		verify(reverseCalcHistoryRepository, never()).delete(any());
	}

	@Test
	void 없는_기록을_지워도_같은_404() {
		// Given
		when(reverseCalcHistoryRepository.findByReverseIdAndMemberId(99L, MEMBER_ID)).thenReturn(Optional.empty());

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> reverseCalcHistoryService.deleteReverseCalc(MEMBER_ID, 99L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 전체_삭제는_내_회원_번호로만_부른다() {
		// Given, When
		reverseCalcHistoryService.deleteReverseCalcs(MEMBER_ID);

		// Then
		verify(reverseCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
	}

	// ---- 같은 기록 다시 저장 (409, B9) ----

	/** 이미 저장된 기록: request(EQUAL_PI)와 입력 4칸이 같음 (결과 칸, 계산 시각은 다름) */
	private static ReverseCalcHistory sameInputCalc(long reverseId) {
		return ReverseCalcHistory.builder()
				.reverseId(reverseId)
				.memberId(MEMBER_ID)
				.repayMethod(RepayMethod.EQUAL_PI)
				.monthlyPayment(1000000L)
				.interestRate(new BigDecimal("4.50"))
				.loanMonths(360)
				.maxLoan(1L)
				.calcAt(LocalDateTime.of(2026, 11, 1, 9, 0))
				.build();
	}

	@Test
	void 입력이_같은_기록이_있으면_409다() {
		// Given
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));
		ReverseCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> reverseCalcHistoryService.saveReverseCalc(MEMBER_ID, request));

		// Then
		assertEquals(ErrorCode.CONFLICT, e.getErrorCode());
	}

	@Test
	void 입력이_같은_기록이_있으면_저장하지_않는다() {
		// Given
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));
		ReverseCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);

		// When
		assertThrows(BusinessException.class, () -> reverseCalcHistoryService.saveReverseCalc(MEMBER_ID, request));

		// Then
		verify(reverseCalcHistoryRepository, never()).save(any());
	}

	@Test
	void 입력_1칸만_달라도_저장한다() {
		// Given 상환 방식만 다름 (원금균등 / 저장된 기록은 원리금균등)
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));

		// When
		reverseCalcHistoryService.saveReverseCalc(MEMBER_ID, request(RepayMethod.EQUAL_P));

		// Then
		verify(reverseCalcHistoryRepository).save(any(ReverseCalcHistory.class));
	}

	@Test
	void 회원_행을_잠근_뒤에_기록을_비교한다() {
		// Given
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(calcs(1));
		InOrder order = inOrder(memberRepository, reverseCalcHistoryRepository);

		// When
		reverseCalcHistoryService.saveReverseCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		order.verify(memberRepository).findLockedByMemberId(MEMBER_ID);
		order.verify(reverseCalcHistoryRepository).findByMemberIdOrderByReverseIdDesc(MEMBER_ID);
	}

	@Test
	void 저장_여부_확인은_입력이_같은_기록이_있으면_true다() {
		// Given
		when(reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));

		// When
		boolean saved = reverseCalcHistoryService.hasSavedReverseCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		assertTrue(saved);
	}
}
