package chorong.calculator.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.ChangeCalcHistoryRequestDTO;
import chorong.calculator.dto.ChangeCalcHistoryResponseDTO;
import chorong.calculator.entity.ChangeCalcHistory;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.ChangeCalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;

/*
 * 갈아타기 계산 기록 저장, 목록, 삭제 (CAL-05)
 * 회원 번호는 세션에서만 받음 (B3) / 저장과 오래된 기록 정리는 한 트랜잭션 (B16)
 */
@Service
@RequiredArgsConstructor
public class ChangeCalcHistoryServiceImpl implements ChangeCalcHistoryService {

	private static final int MAX_CALCS = 10;	// 회원당 기록 수

	private final ChangeCalcHistoryRepository changeCalcHistoryRepository;

	@Override
	@Transactional
	public void saveChangeCalc(Long memberId, ChangeCalcHistoryRequestDTO request) {
		// 1. 값 확인 (칸마다 범위는 DTO에서 확인함, 상환 방식 코드는 여기서)
		if (request.getCurrentRepayMethod() == RepayMethod.GRADUATED
				|| request.getNewRepayMethod() == RepayMethod.GRADUATED) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "상환 방식을 확인해 주세요.");
		}

		// 2. 저장
		changeCalcHistoryRepository.save(request.toEntity(memberId, LocalDateTime.now().withNano(0)));

		// 3. 10개 넘으면 가장 오래된 기록부터 삭제
		List<ChangeCalcHistory> calcs = changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			changeCalcHistoryRepository.deleteAll(calcs.subList(MAX_CALCS, calcs.size()));
		}
	}

	@Override
	@Transactional(readOnly = true)
	public ChangeCalcHistoryResponseDTO getChangeCalcs(Long memberId) {
		List<ChangeCalcHistoryResponseDTO.Item> items = changeCalcHistoryRepository
				.findByMemberIdOrderByChangeIdDesc(memberId)
				.stream()
				.map(ChangeCalcHistoryResponseDTO.Item::from)
				.toList();
		return new ChangeCalcHistoryResponseDTO(items);
	}

	@Override
	@Transactional
	public void deleteChangeCalc(Long memberId, Long changeId) {
		// 남의 기록과 없는 기록은 같은 404
		ChangeCalcHistory calc = changeCalcHistoryRepository.findByChangeIdAndMemberId(changeId, memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		changeCalcHistoryRepository.delete(calc);
	}

	@Override
	@Transactional
	public void deleteChangeCalcs(Long memberId) {
		changeCalcHistoryRepository.deleteByMemberId(memberId);
	}
}
