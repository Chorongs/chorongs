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

import chorong.calculator.dto.HomeLimitCalcHistoryRequestDTO;
import chorong.calculator.dto.HomeLimitCalcHistoryResponseDTO;
import chorong.calculator.entity.HomeLimitCalcHistory;
import chorong.calculator.entity.HomeOtherLoan;
import chorong.calculator.entity.HomeRateType;
import chorong.calculator.entity.HomeRegion;
import chorong.calculator.entity.LoanKind;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.HomeLimitCalcHistoryRepository;
import chorong.calculator.repository.HomeOtherLoanRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.member.entity.Member;
import chorong.member.repository.MemberRepository;

/*
 * HomeLimitCalcHistoryServiceImpl 테스트 (CAL-08)
 * 상환 방식 코드 B2 (EQUAL_PI, EQUAL_P만), 남의 기록 삭제 차단 B3, 회원당 10개
 * 다른 대출 행(home_other_loan) 저장, 붙이기, 먼저 지우기 (2026-11-26)
 */
class HomeLimitCalcHistoryServiceImplTest {

	private static final Long MEMBER_ID = 1L;
	private static final Long OTHER_MEMBER_ID = 2L;

	private HomeLimitCalcHistoryRepository homeLimitCalcHistoryRepository;
	private HomeOtherLoanRepository homeOtherLoanRepository;
	private HomeLimitCalcHistoryServiceImpl homeLimitCalcHistoryService;
	private MemberRepository memberRepository;

	@BeforeEach
	void setUp() {
		homeLimitCalcHistoryRepository = mock(HomeLimitCalcHistoryRepository.class);
		homeOtherLoanRepository = mock(HomeOtherLoanRepository.class);
		memberRepository = mock(MemberRepository.class);
		// 회원 행 잠금은 늘 회원을 찾음 (B9)
		when(memberRepository.findLockedByMemberId(MEMBER_ID)).thenReturn(Optional.of(BeanUtils.instantiateClass(Member.class)));
		homeLimitCalcHistoryService = new HomeLimitCalcHistoryServiceImpl(homeLimitCalcHistoryRepository, homeOtherLoanRepository,
				memberRepository);
	}

	// ---- 테스트 데이터 ----

	private static HomeLimitCalcHistoryRequestDTO request(RepayMethod repayMethod) {
		return new HomeLimitCalcHistoryRequestDTO(500000000L, HomeRegion.REGULATED, "Y", 80000000L, 2000000L,
				new BigDecimal("4.5"), 30, repayMethod, 300000000L, 250000000L, 300000000L, HomeRateType.VARIABLE, null);
	}

	/** 다른 대출 2건을 넣은 요청: 신용대출 원리금균등 3천만원 5% 60개월, 기타 만기일시 1천만원 6% 12개월 */
	private static HomeLimitCalcHistoryRequestDTO requestWithLoans() {
		HomeLimitCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);
		request.setOtherLoans(List.of(
				new HomeLimitCalcHistoryRequestDTO.OtherLoanItem(LoanKind.CREDIT, RepayMethod.EQUAL_PI, 30000000L,
						new BigDecimal("5"), 60),
				new HomeLimitCalcHistoryRequestDTO.OtherLoanItem(LoanKind.OTHER, RepayMethod.BULLET, 10000000L,
						new BigDecimal("6"), 12)));
		return request;
	}

	/** 저장된 다른 대출 행 (requestWithLoans의 sortNo번째 건과 같은 입력) */
	private static HomeOtherLoan savedLoan(long homeId, int sortNo) {
		boolean first = sortNo == 1;
		return HomeOtherLoan.builder()
				.homeOtherLoanId(homeId * 100 + sortNo)
				.homeId(homeId)
				.sortNo(sortNo)
				.loanKind(first ? LoanKind.CREDIT : LoanKind.OTHER)
				.repayMethod(first ? RepayMethod.EQUAL_PI : RepayMethod.BULLET)
				.loanAmount(first ? 30000000L : 10000000L)
				.interestRate(new BigDecimal(first ? "5.00" : "6.00"))
				.loanMonths(first ? 60 : 12)
				.build();
	}

	// 이미 저장된 기록 예시: 금액이 request와 달라 같은 기록이 아님 (같은 기록 409를 피해 10개 정리 등을 확인)
	private static HomeLimitCalcHistory calc(long homeId, long memberId) {
		return HomeLimitCalcHistory.builder()
				.homeId(homeId)
				.memberId(memberId)
				.housePrice(600000000L)
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

	// ---- 같은 기록 다시 저장 (409, B9) ----

	/** 이미 저장된 기록: request(EQUAL_PI)와 입력 9칸이 같음 (결과 칸, 계산 시각은 다름, 다른 대출 없음) */
	private static HomeLimitCalcHistory sameInputCalc(long homeId) {
		return HomeLimitCalcHistory.builder()
				.homeId(homeId)
				.memberId(MEMBER_ID)
				.housePrice(500000000L)
				.homeRegion(HomeRegion.REGULATED)
				.firstHome("Y")
				.annualIncome(80000000L)
				.otherInterest(2000000L)
				.interestRate(new BigDecimal("4.50"))
				.loanYears(30)
				.repayMethod(RepayMethod.EQUAL_PI)
				.rateType(HomeRateType.VARIABLE)
				.maxLoan(1L)
				.ltvLimit(1L)
				.dtiLimit(1L)
				.calcAt(LocalDateTime.of(2026, 11, 1, 9, 0))
				.build();
	}

	@Test
	void 입력이_같은_기록이_있으면_409다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));
		HomeLimitCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request));

		// Then
		assertEquals(ErrorCode.CONFLICT, e.getErrorCode());
	}

	@Test
	void 입력이_같은_기록이_있으면_저장하지_않는다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));
		HomeLimitCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);

		// When
		assertThrows(BusinessException.class, () -> homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request));

		// Then
		verify(homeLimitCalcHistoryRepository, never()).save(any());
	}

	@Test
	void 입력_1칸만_달라도_저장한다() {
		// Given 상환 방식만 다름 (원금균등 / 저장된 기록은 원리금균등)
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request(RepayMethod.EQUAL_P));

		// Then
		verify(homeLimitCalcHistoryRepository).save(any(HomeLimitCalcHistory.class));
	}

	@Test
	void 회원_행을_잠근_뒤에_기록을_비교한다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(calcs(1));
		InOrder order = inOrder(memberRepository, homeLimitCalcHistoryRepository);

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		order.verify(memberRepository).findLockedByMemberId(MEMBER_ID);
		order.verify(homeLimitCalcHistoryRepository).findByMemberIdOrderByHomeIdDesc(MEMBER_ID);
	}

	@Test
	void 저장_여부_확인은_입력이_같은_기록이_있으면_true다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));

		// When
		boolean saved = homeLimitCalcHistoryService.hasSavedHomeCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		assertTrue(saved);
	}

	@Test
	void 금리_유형만_달라도_저장한다() {
		// Given 저장된 기록은 변동형, 요청은 고정형
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));
		HomeLimitCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);
		request.setRateType(HomeRateType.FIXED);

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request);

		// Then
		verify(homeLimitCalcHistoryRepository).save(any(HomeLimitCalcHistory.class));
	}

	@Test
	void 금리_유형을_저장한다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(calcs(1));
		HomeLimitCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);
		request.setRateType(HomeRateType.MIXED);

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request);

		// Then
		ArgumentCaptor<HomeLimitCalcHistory> captor = ArgumentCaptor.forClass(HomeLimitCalcHistory.class);
		verify(homeLimitCalcHistoryRepository).save(captor.capture());
		assertEquals(HomeRateType.MIXED, captor.getValue().getRateType());
	}

	// ---- 다른 대출 (home_other_loan) ----

	@Test
	@SuppressWarnings("unchecked")
	void 다른_대출을_저장한_계산_번호로_입력_순서대로_저장한다() {
		// Given 저장하면 번호 100이 붙은 계산이 돌아옴 (IDENTITY)
		when(homeLimitCalcHistoryRepository.save(any(HomeLimitCalcHistory.class))).thenReturn(calc(100, MEMBER_ID));
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(List.of());

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, requestWithLoans());

		// Then 번호 100, 순서 1, 2, 금리는 소수 2자리
		ArgumentCaptor<List<HomeOtherLoan>> captor = ArgumentCaptor.forClass(List.class);
		verify(homeOtherLoanRepository).saveAll(captor.capture());
		List<HomeOtherLoan> loans = captor.getValue();
		assertEquals(List.of("100-1-CREDIT-5.00", "100-2-OTHER-6.00"),
				loans.stream().map(l -> l.getHomeId() + "-" + l.getSortNo() + "-" + l.getLoanKind() + "-" + l.getInterestRate()).toList());
	}

	@Test
	void 다른_대출이_없으면_다른_대출_행을_저장하지_않는다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(List.of());

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		verify(homeOtherLoanRepository, never()).saveAll(anyList());
	}

	@Test
	void 다른_대출이_체증식이면_400이고_저장하지_않는다() {
		// Given
		HomeLimitCalcHistoryRequestDTO request = request(RepayMethod.EQUAL_PI);
		request.setOtherLoans(List.of(new HomeLimitCalcHistoryRequestDTO.OtherLoanItem(LoanKind.CREDIT,
				RepayMethod.GRADUATED, 30000000L, new BigDecimal("5"), 60)));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request));

		// Then
		assertEquals(ErrorCode.INVALID_INPUT, e.getErrorCode());
	}

	@Test
	void 계산_칸과_다른_대출_목록이_같으면_409다() {
		// Given 저장된 1번 기록: 계산 칸 같음 + 다른 대출 2건 같음 (금리 5.00, 6.00 = 요청 5, 6)
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));
		when(homeOtherLoanRepository.findByHomeIdInOrderByHomeIdAscSortNoAsc(List.of(1L)))
				.thenReturn(List.of(savedLoan(1, 1), savedLoan(1, 2)));
		HomeLimitCalcHistoryRequestDTO request = requestWithLoans();

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request));

		// Then
		assertEquals(ErrorCode.CONFLICT, e.getErrorCode());
	}

	@Test
	void 계산_칸이_같아도_다른_대출_건수가_다르면_저장한다() {
		// Given 저장된 1번 기록은 다른 대출 1건만
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(List.of(sameInputCalc(1)));
		when(homeLimitCalcHistoryRepository.save(any(HomeLimitCalcHistory.class))).thenReturn(calc(100, MEMBER_ID));
		when(homeOtherLoanRepository.findByHomeIdInOrderByHomeIdAscSortNoAsc(List.of(1L))).thenReturn(List.of(savedLoan(1, 1)));

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, requestWithLoans());

		// Then
		verify(homeLimitCalcHistoryRepository).save(any(HomeLimitCalcHistory.class));
	}

	@Test
	@SuppressWarnings("unchecked")
	void 기록이_11개가_되면_오래된_기록의_다른_대출_행을_먼저_지운다() {
		// Given
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(calcs(11));
		InOrder order = inOrder(homeOtherLoanRepository, homeLimitCalcHistoryRepository);

		// When
		homeLimitCalcHistoryService.saveHomeCalc(MEMBER_ID, request(RepayMethod.EQUAL_PI));

		// Then
		order.verify(homeOtherLoanRepository).deleteByHomeIdIn(List.of(1L));
		order.verify(homeLimitCalcHistoryRepository).deleteAll(anyList());
	}

	@Test
	void 목록에_다른_대출을_계산마다_입력_순서대로_붙인다() {
		// Given 3번 기록에 다른 대출 2건, 1, 2번 기록은 없음
		when(homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(MEMBER_ID)).thenReturn(calcs(3));
		when(homeOtherLoanRepository.findByHomeIdInOrderByHomeIdAscSortNoAsc(List.of(3L, 2L, 1L)))
				.thenReturn(List.of(savedLoan(3, 1), savedLoan(3, 2)));

		// When
		HomeLimitCalcHistoryResponseDTO response = homeLimitCalcHistoryService.getHomeCalcs(MEMBER_ID);

		// Then
		assertEquals(List.of(2, 0, 0), response.getItems().stream().map(item -> item.getOtherLoans().size()).toList());
	}

	@Test
	void 내_기록_1건을_지울_때_다른_대출_행을_먼저_지운다() {
		// Given
		HomeLimitCalcHistory mine = calc(5, MEMBER_ID);
		when(homeLimitCalcHistoryRepository.findByHomeIdAndMemberId(5L, MEMBER_ID)).thenReturn(Optional.of(mine));
		InOrder order = inOrder(homeOtherLoanRepository, homeLimitCalcHistoryRepository);

		// When
		homeLimitCalcHistoryService.deleteHomeCalc(MEMBER_ID, 5L);

		// Then
		order.verify(homeOtherLoanRepository).deleteByHomeIdIn(List.of(5L));
		order.verify(homeLimitCalcHistoryRepository).delete(mine);
	}

	@Test
	void 전체_삭제는_다른_대출_행을_먼저_지운다() {
		// Given
		InOrder order = inOrder(homeOtherLoanRepository, homeLimitCalcHistoryRepository);

		// When
		homeLimitCalcHistoryService.deleteHomeCalcs(MEMBER_ID);

		// Then
		order.verify(homeOtherLoanRepository).deleteByMemberId(MEMBER_ID);
		order.verify(homeLimitCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
	}
}
