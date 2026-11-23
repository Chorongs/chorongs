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

import chorong.calculator.dto.HomeLimitCalcHistoryRequestDTO;
import chorong.calculator.dto.HomeLimitCalcHistoryResponseDTO;
import chorong.calculator.entity.HomeLimitCalcHistory;
import chorong.calculator.entity.HomeRegion;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.HomeLimitCalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * HomeLimitCalcHistoryServiceImpl 테스트 (CAL-08)
 * 상환 방식 코드 B2 (EQUAL_PI, EQUAL_P만), 남의 기록 삭제 차단 B3, 회원당 10개
 */
class HomeLimitCalcHistoryServiceImplTest {

	private static final Long MEMBER_ID = 1L;
	private static final Long OTHER_MEMBER_ID = 2L;

	private HomeLimitCalcHistoryRepository homeLimitCalcHistoryRepository;
	private HomeLimitCalcHistoryServiceImpl homeLimitCalcHistoryService;

	@BeforeEach
	void setUp() {
		homeLimitCalcHistoryRepository = mock(HomeLimitCalcHistoryRepository.class);
		homeLimitCalcHistoryService = new HomeLimitCalcHistoryServiceImpl(homeLimitCalcHistoryRepository);
	}

	// ---- 테스트 데이터 ----

	private static HomeLimitCalcHistoryRequestDTO request(RepayMethod repayMethod) {
		return new HomeLimitCalcHistoryRequestDTO(500000000L, HomeRegion.REGULATED, "Y", 80000000L, 2000000L,
				new BigDecimal("4.5"), 30, repayMethod, 300000000L, 250000000L, 300000000L);
	}

	private static HomeLimitCalcHistory calc(long homeId, long memberId) {
		return HomeLimitCalcHistory.builder()
				.homeId(homeId)
				.memberId(memberId)
				.housePrice(500000000L)
				.homeRegion(HomeRegion.REGULATED)
				.firstHome("Y")
				.annualIncome(80000000L)
				.otherInterest(2000000L)
				.interestRate(new BigDecimal("4.50"))
				.loanYears(30)
				.repayMethod(RepayMethod.EQUAL_PI)
				.maxLoan(300000000L)
				.ltvLimit(250000000L)
				.dtiLimit(300000000L)
				.calcAt(LocalDateTime.of(2026, 11, 20, 10, 30))
				.build();
	}

	/** 최신 번호가 앞에 오는 기록 n개 (번호 n ~ 1) */
	private static List<HomeLimitCalcHistory> calcs(int count) {
		List<HomeLimitCalcHistory> list = new ArrayList<>();
		for (int i = count; i >= 1; i--) {
			list.add(calc(i, MEMBER_ID));
		}
		return list;
	}

	private void assertRejected(RepayMethod repayMethod) {
		HomeLimitCalcHistoryRequestDTO request = request(repayMethod);
		BusinessException e = assertThrows(BusinessException.class,
				() -> homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request));
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
		verify(homeLimitCalcHistoryRepository, never()).save(any());
	}

	// ---- 저장 ----

	@Test
	void 원금균등이면_세션_회원_번호로_저장한다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request(RepayMethod.EQUAL_P));

		// Then
		ArgumentCaptor<HomeLimitCalcHistory> captor = ArgumentCaptor.forClass(HomeLimitCalcHistory.class);
		verify(homeLimitCalcHistoryRepository).save(captor.capture());
		assertEquals(MEMBER_ID, captor.getValue().getMemberId());
		assertEquals(RepayMethod.EQUAL_P, captor.getValue().getRepayMethod());
		assertEquals("Y", captor.getValue().getFirstHome());
	}

	@Test
	void 만기일시면_400이고_저장하지_않는다() {
		// Given, When, Then
		assertRejected(RepayMethod.BULLET);
	}

	@Test
	void 체증식이면_400이고_저장하지_않는다() {
		// Given, When, Then
		assertRejected(RepayMethod.GRADUATED);
	}

	@Test
	void 금리는_소수_2자리로_저장한다() {
		// Given
		HomeLimitCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);
		request.setInterestRate(new BigDecimal("4.567"));
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(calcs(1));

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request);

		// Then
		ArgumentCaptor<HomeLimitCalcHistory> captor = ArgumentCaptor.forClass(HomeLimitCalcHistory.class);
		verify(homeLimitCalcHistoryRepository).save(captor.capture());
		assertEquals(new BigDecimal("4.57"), captor.getValue().getInterestRate());
	}

	// ---- 회원당 10개 ----

	@Test
	void 기록이_10개_이하면_지우지_않는다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(calcs(10));

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		verify(homeLimitCalcHistoryRepository, never()).deleteAll(anyList());
	}

	@Test
	@SuppressWarnings("unchecked")
	void 기록이_11개가_되면_가장_오래된_1개를_지운다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(calcs(11));

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		ArgumentCaptor<List<HomeLimitCalcHistory>> captor = ArgumentCaptor.forClass(List.class);
		verify(homeLimitCalcHistoryRepository).deleteAll(captor.capture());
		assertEquals(1, captor.getValue().size());
		assertEquals(1L, captor.getValue().get(0).getHomeId());
	}

	// ---- 목록 ----

	@Test
	void 목록은_최신_기록_순서를_그대로_응답으로_바꾼다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(calcs(3));

		// When
		HomeLimitCalcHistoryResponseDTO response = homeLimitCalcHistoryService.getHomeCalcs(MEMBER_ID);

		// Then
		assertEquals(3, response.getItems().size());
		assertEquals(3L, response.getItems().get(0).getHomeId());
		assertEquals(HomeRegion.REGULATED, response.getItems().get(0).getHomeRegion());
	}

	// ---- 삭제 (B3) ----

	@Test
	void 내_기록_1건을_지운다() {
		// Given
		HomeLimitCalcHistory mine = calc(5, MEMBER_ID);
		when(homeLimitCalcHistoryRepository.findByHomeIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.of(mine));

		// When
		homeLimitCalcHistoryService.deleteHomeCalc(MEMBER_ID, 5L);

		// Then
		verify(homeLimitCalcHistoryRepository).delete(mine);
	}

	@Test
	void 남의_기록을_지우면_404이고_지우지_않는다() {
		// Given: 5번 기록은 회원 2의 것이라 회원 1 조건으로는 찾아지지 않음
		when(homeLimitCalcHistoryRepository.findByHomeIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.empty());
		when(homeLimitCalcHistoryRepository.findByHomeIdAndMemberId(5L, OTHER_MEMBER_ID))
				.thenReturn(Optional.of(calc(5, OTHER_MEMBER_ID)));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> homeLimitCalcHistoryService.deleteHomeCalc(MEMBER_ID, 5L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
		verify(homeLimitCalcHistoryRepository, never()).delete(any());
	}

	@Test
	void 없는_기록을_지워도_같은_404() {
		// Given
		when(homeLimitCalcHistoryRepository.findByHomeIdAndMemberId(99L, MEMBER_ID)).thenReturn(Optional.empty());

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> homeLimitCalcHistoryService.deleteHomeCalc(MEMBER_ID, 99L));

		// Then
		assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
	}

	@Test
	void 전체_삭제는_내_회원_번호로만_부른다() {
		// Given, When
		homeLimitCalcHistoryService.deleteHomeCalcs(MEMBER_ID);

		// Then
		verify(homeLimitCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
	}
}
