package chorong.calculator.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.CalcHistoryRequestDTO;
import chorong.calculator.dto.CalcHistoryResponseDTO;
import chorong.calculator.entity.CalcHistory;
import chorong.calculator.repository.CalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;

/*
 * 계산 기록 저장, 목록, 삭제 (CAL-04)
 * 회원 번호는 세션에서만 받음 (B3) / 저장과 오래된 기록 정리는 한 트랜잭션 (B16)
 */
@Service
@RequiredArgsConstructor
public class CalcHistoryServiceImpl implements CalcHistoryService {

	private static final int MAX_CALCS = 10;	// 회원당 기록 수
	private static final Set<Integer> LOAN_MONTHS = Set.of(12, 36, 60, 120, 180);	// 고를 수 있는 대출 기간

	private final CalcHistoryRepository calcHistoryRepository;

	@Override
	@Transactional
	public void saveCalc(Long memberId, CalcHistoryRequestDTO request) {
		// 1. 값 확인 (범위는 DTO에서 확인함, 기간 목록은 여기서)
		if (!LOAN_MONTHS.contains(request.getLoanMonths())) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "대출 기간을 확인해 주세요.");
		}

		// 2. 저장
		calcHistoryRepository.save(request.toEntity(memberId, LocalDateTime.now().withNano(0)));

		// 3. 10개 넘으면 가장 오래된 기록부터 삭제
		List<CalcHistory> calcs = calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			calcHistoryRepository.deleteAll(calcs.subList(MAX_CALCS, calcs.size()));
		}
	}

	@Override
	@Transactional(readOnly = true)
	public CalcHistoryResponseDTO getCalcs(Long memberId) {
		List<CalcHistoryResponseDTO.Item> items = calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(memberId)
				.stream()
				.map(CalcHistoryResponseDTO.Item::from)
				.toList();
		return new CalcHistoryResponseDTO(items);
	}

	@Override
	@Transactional
	public void deleteCalc(Long memberId, Long calcId) {
		// 남의 기록과 없는 기록은 같은 404
		CalcHistory calc = calcHistoryRepository.findByCalcIdAndMemberId(calcId, memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		calcHistoryRepository.delete(calc);
	}

	@Override
	@Transactional
	public void deleteCalcs(Long memberId) {
		calcHistoryRepository.deleteByMemberId(memberId);
	}
}
