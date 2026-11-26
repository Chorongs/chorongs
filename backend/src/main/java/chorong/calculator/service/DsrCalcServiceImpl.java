package chorong.calculator.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.DsrCalcRequestDTO;
import chorong.calculator.dto.DsrCalcResponseDTO;
import chorong.calculator.entity.DsrCalcHistory;
import chorong.calculator.entity.DsrLoan;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.DsrCalcHistoryRepository;
import chorong.calculator.repository.DsrLoanRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;

/*
 * DSR 계산 기록 저장, 목록, 삭제 (CAL-06)
 * 회원 번호는 세션에서만 받음 (B3) / 테이블 2개(계산, 대출)를 한 트랜잭션으로 (B16)
 * ON DELETE CASCADE를 쓰지 않으므로 지울 때는 항상 dsr_loan을 먼저 지움
 */
@Service
@RequiredArgsConstructor
public class DsrCalcServiceImpl implements DsrCalcService {

	private static final int MAX_CALCS = 10;	// 회원당 기록 수
	private static final String MSG_ALREADY_SAVED = "이미 저장한 계산 기록이에요";	// 같은 기록 다시 저장 409 (B9)

	private final DsrCalcHistoryRepository dsrCalcHistoryRepository;
	private final DsrLoanRepository dsrLoanRepository;
	private final MemberRepository memberRepository;

	@Override
	@Transactional
	public void saveDsrCalc(Long memberId, DsrCalcRequestDTO request) {
		// 1. 값 확인 (칸마다 범위와 대출 건수 1-10은 DTO에서 확인함, 상환 방식 코드는 여기서)
		boolean graduated = request.getLoans().stream().anyMatch(loan -> loan.getRepayMethod() == RepayMethod.GRADUATED);
		if (graduated) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "상환 방식을 확인해 주세요.");
		}

		// 2. 회원 행 잠금 (B9): 같은 회원의 저장은 한 번에 하나씩 -> 다른 탭, 단말기에서 동시에 눌러도 같은 기록 확인과 10개 정리가 맞음
		memberRepository.findLockedByMemberId(memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));

		// 3. 저장할 모양을 먼저 만들어 내 기록과 비교: 연소득과 대출 목록(건수, 순서, 건마다 5칸)이 모두 같으면 409 (결과 칸, 계산 시각은 비교 안 함)
		DsrCalcHistory calc = request.toEntity(memberId, LocalDateTime.now().withNano(0));
		if (hasSameInput(memberId, calc, request.toLoanEntities(null))) {
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_SAVED);
		}

		// 4. 계산 1행 저장 -> 번호를 달아 대출 행을 건수만큼 저장
		DsrCalcHistory savedCalc = dsrCalcHistoryRepository.save(calc);
		dsrLoanRepository.saveAll(request.toLoanEntities(savedCalc.getDsrId()));

		// 5. 10개 넘으면 가장 오래된 기록부터 삭제 (대출 행 먼저)
		List<DsrCalcHistory> calcs = dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			List<DsrCalcHistory> oldCalcs = calcs.subList(MAX_CALCS, calcs.size());
			dsrLoanRepository.deleteByDsrIdIn(oldCalcs.stream().map(DsrCalcHistory::getDsrId).toList());
			dsrCalcHistoryRepository.deleteAll(oldCalcs);
		}
	}

	// 같은 기록을 이미 저장했는지 (읽기만 하므로 잠그지 않음, 저장은 잠근 뒤 다시 확인)
	@Override
	@Transactional(readOnly = true)
	public boolean hasSavedDsrCalc(Long memberId, DsrCalcRequestDTO request) {
		return hasSameInput(memberId, request.toEntity(memberId, null), request.toLoanEntities(null));
	}

	// 내 기록 중 같은 기록이 있는지: 연소득이 같고 대출 목록이 건수, 순서, 건마다 5칸까지 같음 (대출 행은 그 계산들 것을 한 번에 읽음)
	private boolean hasSameInput(Long memberId, DsrCalcHistory calc, List<DsrLoan> loans) {
		List<DsrCalcHistory> calcs = dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(memberId);
		if (calcs.isEmpty()) {
			return false;
		}
		List<Long> dsrIds = calcs.stream().map(DsrCalcHistory::getDsrId).toList();
		Map<Long, List<DsrLoan>> loansByDsrId = dsrLoanRepository.findByDsrIdInOrderByDsrIdAscSortNoAsc(dsrIds)
				.stream()
				.collect(Collectors.groupingBy(DsrLoan::getDsrId));
		return calcs.stream().anyMatch(saved -> Objects.equals(saved.getAnnualIncome(), calc.getAnnualIncome())
				&& sameLoans(loansByDsrId.getOrDefault(saved.getDsrId(), List.of()), loans));
	}

	// 대출 목록이 같은지: 건수가 같고, 입력 순서대로 건마다 종류, 상환 방식, 대출금, 금리, 기간이 같음
	private static boolean sameLoans(List<DsrLoan> a, List<DsrLoan> b) {
		if (a.size() != b.size()) {
			return false;
		}
		for (int i = 0; i < a.size(); i++) {
			DsrLoan x = a.get(i);
			DsrLoan y = b.get(i);
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

	// 소수 칸 비교: 5.5와 5.50은 같음 (equals는 소수 자리 수까지 봐서 compareTo), 둘 다 null이면 같고 한쪽만 null이면 다름
	private static boolean sameNumber(BigDecimal a, BigDecimal b) {
		return a == null ? b == null : b != null && a.compareTo(b) == 0;
	}

	@Override
	@Transactional(readOnly = true)
	public DsrCalcResponseDTO getDsrCalcs(Long memberId) {
		List<DsrCalcHistory> calcs = dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(memberId);
		if (calcs.isEmpty()) {
			return new DsrCalcResponseDTO(List.of());
		}

		// 그 계산들의 대출 행을 한 번에 읽어 계산 번호별로 붙임 (입력 순서 유지)
		List<Long> dsrIds = calcs.stream().map(DsrCalcHistory::getDsrId).toList();
		Map<Long, List<DsrLoan>> loansByDsrId = dsrLoanRepository.findByDsrIdInOrderByDsrIdAscSortNoAsc(dsrIds)
				.stream()
				.collect(Collectors.groupingBy(DsrLoan::getDsrId));

		List<DsrCalcResponseDTO.Item> items = calcs.stream()
				.map(calc -> DsrCalcResponseDTO.Item.from(calc, loansByDsrId.getOrDefault(calc.getDsrId(), List.of())))
				.toList();
		return new DsrCalcResponseDTO(items);
	}

	@Override
	@Transactional
	public void deleteDsrCalc(Long memberId, Long dsrId) {
		// 남의 기록과 없는 기록은 같은 404
		DsrCalcHistory calc = dsrCalcHistoryRepository.findByDsrIdAndMemberId(dsrId, memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		dsrLoanRepository.deleteByDsrIdIn(List.of(calc.getDsrId()));
		dsrCalcHistoryRepository.delete(calc);
	}

	@Override
	@Transactional
	public void deleteDsrCalcs(Long memberId) {
		dsrLoanRepository.deleteByMemberId(memberId);
		dsrCalcHistoryRepository.deleteByMemberId(memberId);
	}
}
