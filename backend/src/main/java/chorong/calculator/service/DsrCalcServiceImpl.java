package chorong.calculator.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
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

	private final DsrCalcHistoryRepository dsrCalcHistoryRepository;
	private final DsrLoanRepository dsrLoanRepository;

	@Override
	@Transactional
	public void saveDsrCalc(Long memberId, DsrCalcRequestDTO request) {
		// 1. 값 확인 (칸마다 범위와 대출 건수 1-10은 DTO에서 확인함, 상환 방식 코드는 여기서)
		boolean graduated = request.getLoans().stream().anyMatch(loan -> loan.getRepayMethod() == RepayMethod.GRADUATED);
		if (graduated) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "상환 방식을 확인해 주세요.");
		}

		// 2. 계산 1행 저장 -> 번호를 달아 대출 행을 건수만큼 저장
		DsrCalcHistory calc = dsrCalcHistoryRepository.save(request.toEntity(memberId, LocalDateTime.now().withNano(0)));
		dsrLoanRepository.saveAll(request.toLoanEntities(calc.getDsrId()));

		// 3. 10개 넘으면 가장 오래된 기록부터 삭제 (대출 행 먼저)
		List<DsrCalcHistory> calcs = dsrCalcHistoryRepository.findByMemberIdOrderByDsrIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			List<DsrCalcHistory> oldCalcs = calcs.subList(MAX_CALCS, calcs.size());
			dsrLoanRepository.deleteByDsrIdIn(oldCalcs.stream().map(DsrCalcHistory::getDsrId).toList());
			dsrCalcHistoryRepository.deleteAll(oldCalcs);
		}
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
