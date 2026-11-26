package chorong.calculator.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.HomeLimitCalcHistoryRequestDTO;
import chorong.calculator.dto.HomeLimitCalcHistoryResponseDTO;
import chorong.calculator.entity.HomeLimitCalcHistory;
import chorong.calculator.entity.HomeOtherLoan;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.HomeLimitCalcHistoryRepository;
import chorong.calculator.repository.HomeOtherLoanRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;

/*
 * 내 집 대출한도 계산 기록 저장, 목록, 삭제 (CAL-08)
 * 회원 번호는 세션에서만 받음 (B3) / 저장과 오래된 기록 정리는 한 트랜잭션 (B16)
 * 다른 대출은 home_other_loan에 건마다 1행 (DSR의 dsr_loan과 같은 방식). ON DELETE CASCADE를 쓰지 않으므로 지울 때는 항상 home_other_loan을 먼저 지움
 */
@Service
@RequiredArgsConstructor
public class HomeLimitCalcHistoryServiceImpl implements HomeLimitCalcHistoryService {

	private static final int MAX_CALCS = 10;	// 회원당 기록 수
	private static final String MSG_ALREADY_SAVED = "이미 저장한 계산 기록이에요";	// 같은 기록 다시 저장 409 (B9)

	private final HomeLimitCalcHistoryRepository homeLimitCalcHistoryRepository;
	private final HomeOtherLoanRepository homeOtherLoanRepository;
	private final MemberRepository memberRepository;

	@Override
	@Transactional
	public void saveHomeCalc(Long memberId, HomeLimitCalcHistoryRequestDTO request) {
		// 1. 값 확인 (칸마다 범위와 다른 대출 건수 0-10은 DTO에서 확인함, 상환 방식은 여기서: 내 집은 원리금균등과 원금균등만, 다른 대출은 체증식 빼고)
		List<HomeOtherLoan> loans = request.toOtherLoanEntities(null);
		boolean graduated = loans.stream().anyMatch(loan -> loan.getRepayMethod() == RepayMethod.GRADUATED);
		if ((request.getRepayMethod() != RepayMethod.EQUAL_PI && request.getRepayMethod() != RepayMethod.EQUAL_P) || graduated) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "상환 방식을 확인해 주세요.");
		}

		// 2. 회원 행 잠금 (B9): 같은 회원의 저장은 한 번에 하나씩 -> 다른 탭, 단말기에서 동시에 눌러도 같은 기록 확인과 10개 정리가 맞음
		memberRepository.findLockedByMemberId(memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));

		// 3. 저장할 모양을 먼저 만들어 내 기록과 비교: 입력 9칸 + 다른 대출 목록이 모두 같으면 409 (결과 칸, 계산 시각은 비교 안 함)
		HomeLimitCalcHistory calc = request.toEntity(memberId, LocalDateTime.now().withNano(0));
		if (hasSameInput(memberId, calc, loans)) {
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_SAVED);
		}

		// 4. 계산 1행 저장 -> 번호를 달아 다른 대출 행을 건수만큼 저장 (0건이면 저장 안 함)
		HomeLimitCalcHistory savedCalc = homeLimitCalcHistoryRepository.save(calc);
		if (!loans.isEmpty()) {
			homeOtherLoanRepository.saveAll(request.toOtherLoanEntities(savedCalc.getHomeId()));
		}

		// 5. 10개 넘으면 가장 오래된 기록부터 삭제 (다른 대출 행 먼저)
		List<HomeLimitCalcHistory> calcs = homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			List<HomeLimitCalcHistory> oldCalcs = calcs.subList(MAX_CALCS, calcs.size());
			homeOtherLoanRepository.deleteByHomeIdIn(oldCalcs.stream().map(HomeLimitCalcHistory::getHomeId).toList());
			homeLimitCalcHistoryRepository.deleteAll(oldCalcs);
		}
	}

	// 같은 기록을 이미 저장했는지 (읽기만 하므로 잠그지 않음, 저장은 잠근 뒤 다시 확인)
	@Override
	@Transactional(readOnly = true)
	public boolean hasSavedHomeCalc(Long memberId, HomeLimitCalcHistoryRequestDTO request) {
		return hasSameInput(memberId, request.toEntity(memberId, null), request.toOtherLoanEntities(null));
	}

	// 내 기록 중 같은 기록이 있는지: 입력 9칸이 같고 다른 대출 목록이 건수, 순서, 건마다 5칸까지 같음 (다른 대출 행은 그 계산들 것을 한 번에 읽음)
	private boolean hasSameInput(Long memberId, HomeLimitCalcHistory calc, List<HomeOtherLoan> loans) {
		List<HomeLimitCalcHistory> calcs = homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(memberId);
		if (calcs.isEmpty()) {
			return false;
		}
		Map<Long, List<HomeOtherLoan>> loansByHomeId = loansByHomeId(calcs);
		return calcs.stream().anyMatch(saved -> isSameInput(saved, calc)
				&& sameLoans(loansByHomeId.getOrDefault(saved.getHomeId(), List.of()), loans));
	}

	// 계산들의 다른 대출 행을 한 번에 읽어 계산 번호별로 (입력 순서 유지)
	private Map<Long, List<HomeOtherLoan>> loansByHomeId(List<HomeLimitCalcHistory> calcs) {
		List<Long> homeIds = calcs.stream().map(HomeLimitCalcHistory::getHomeId).toList();
		return homeOtherLoanRepository.findByHomeIdInOrderByHomeIdAscSortNoAsc(homeIds)
				.stream()
				.collect(Collectors.groupingBy(HomeOtherLoan::getHomeId));
	}

	// 다른 대출 목록이 같은지: 건수가 같고, 입력 순서대로 건마다 종류, 상환 방식, 잔액, 금리, 남은 기간이 같음
	private static boolean sameLoans(List<HomeOtherLoan> a, List<HomeOtherLoan> b) {
		if (a.size() != b.size()) {
			return false;
		}
		for (int i = 0; i < a.size(); i++) {
			HomeOtherLoan x = a.get(i);
			HomeOtherLoan y = b.get(i);
			boolean same = x.getLoanKind() == y.getLoanKind()
					&& x.getRepayMethod() == y.getRepayMethod()
					&& Objects.equals(x.getLoanAmount(), y.getLoanAmount())
					&& sameNumber(x.getInterestRate(), y.getInterestRate())
					&& Objects.equals(x.getLoanMonths(), y.getLoanMonths());
			if (!same) {
				return false;
			}
		}
		return true;
	}

	// 같은 계산 칸인지: 입력 9칸 (집값, 지역, 생애 첫 집, 연소득, 다른 대출 이자 합계, 금리, 기간, 상환 방식, 금리 유형)이 모두 같음 (금리는 저장할 때처럼 소수 2자리로 맞춘 toEntity 값끼리)
	private static boolean isSameInput(HomeLimitCalcHistory a, HomeLimitCalcHistory b) {
		return Objects.equals(a.getHousePrice(), b.getHousePrice())
				&& a.getHomeRegion() == b.getHomeRegion()
				&& Objects.equals(a.getFirstHome(), b.getFirstHome())
				&& Objects.equals(a.getAnnualIncome(), b.getAnnualIncome())
				&& Objects.equals(a.getOtherInterest(), b.getOtherInterest())
				&& sameNumber(a.getInterestRate(), b.getInterestRate())
				&& Objects.equals(a.getLoanYears(), b.getLoanYears())
				&& a.getRepayMethod() == b.getRepayMethod()
				&& a.getRateType() == b.getRateType();
	}

	// 소수 칸 비교: 5.5와 5.50은 같음 (equals는 소수 자리 수까지 봐서 compareTo), 둘 다 null이면 같고 한쪽만 null이면 다름
	private static boolean sameNumber(BigDecimal a, BigDecimal b) {
		return a == null ? b == null : b != null && a.compareTo(b) == 0;
	}

	@Override
	@Transactional(readOnly = true)
	public HomeLimitCalcHistoryResponseDTO getHomeCalcs(Long memberId) {
		List<HomeLimitCalcHistory> calcs = homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(memberId);
		if (calcs.isEmpty()) {
			return new HomeLimitCalcHistoryResponseDTO(List.of());
		}

		// 그 계산들의 다른 대출 행을 한 번에 읽어 계산 번호별로 붙임 (입력 순서 유지, 없으면 빈 목록)
		Map<Long, List<HomeOtherLoan>> loansByHomeId = loansByHomeId(calcs);
		List<HomeLimitCalcHistoryResponseDTO.Item> items = calcs.stream()
				.map(calc -> HomeLimitCalcHistoryResponseDTO.Item.from(calc, loansByHomeId.getOrDefault(calc.getHomeId(), List.of())))
				.toList();
		return new HomeLimitCalcHistoryResponseDTO(items);
	}

	@Override
	@Transactional
	public void deleteHomeCalc(Long memberId, Long homeId) {
		// 남의 기록과 없는 기록은 같은 404
		HomeLimitCalcHistory calc = homeLimitCalcHistoryRepository.findByHomeIdAndMemberId(homeId, memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		homeOtherLoanRepository.deleteByHomeIdIn(List.of(calc.getHomeId()));
		homeLimitCalcHistoryRepository.delete(calc);
	}

	@Override
	@Transactional
	public void deleteHomeCalcs(Long memberId) {
		homeOtherLoanRepository.deleteByMemberId(memberId);
		homeLimitCalcHistoryRepository.deleteByMemberId(memberId);
	}
}
