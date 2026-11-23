package chorong.calculator.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.ReverseCalcHistoryRequestDTO;
import chorong.calculator.dto.ReverseCalcHistoryResponseDTO;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.entity.ReverseCalcHistory;
import chorong.calculator.repository.ReverseCalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;

/*
 * 상환능력 기반 대출 계산 기록 저장, 목록, 삭제 (CAL-07)
 * 회원 번호는 세션에서만 받음 (B3) / 저장과 오래된 기록 정리는 한 트랜잭션 (B16)
 */
@Service
@RequiredArgsConstructor
public class ReverseCalcHistoryServiceImpl implements ReverseCalcHistoryService {

	private static final int MAX_CALCS = 10;	// 회원당 기록 수

	private final ReverseCalcHistoryRepository reverseCalcHistoryRepository;

	@Override
	@Transactional
	public void saveReverseCalc(Long memberId, ReverseCalcHistoryRequestDTO request) {
		// 1. 값 확인 (칸마다 범위는 DTO에서 확인함, 상환 방식 코드는 여기서)
		if (request.getRepayMethod() == RepayMethod.GRADUATED) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "상환 방식을 확인해 주세요.");
		}

		// 2. 저장
		reverseCalcHistoryRepository.save(request.toEntity(memberId, LocalDateTime.now().withNano(0)));

		// 3. 10개 넘으면 가장 오래된 기록부터 삭제
		List<ReverseCalcHistory> calcs = reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			reverseCalcHistoryRepository.deleteAll(calcs.subList(MAX_CALCS, calcs.size()));
		}
	}

	@Override
	@Transactional(readOnly = true)
	public ReverseCalcHistoryResponseDTO getReverseCalcs(Long memberId) {
		List<ReverseCalcHistoryResponseDTO.Item> items = reverseCalcHistoryRepository
				.findByMemberIdOrderByReverseIdDesc(memberId)
				.stream()
				.map(ReverseCalcHistoryResponseDTO.Item::from)
				.toList();
		return new ReverseCalcHistoryResponseDTO(items);
	}

	@Override
	@Transactional
	public void deleteReverseCalc(Long memberId, Long reverseId) {
		// 남의 기록과 없는 기록은 같은 404
		ReverseCalcHistory calc = reverseCalcHistoryRepository.findByReverseIdAndMemberId(reverseId, memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		reverseCalcHistoryRepository.delete(calc);
	}

	@Override
	@Transactional
	public void deleteReverseCalcs(Long memberId) {
		reverseCalcHistoryRepository.deleteByMemberId(memberId);
	}
}
