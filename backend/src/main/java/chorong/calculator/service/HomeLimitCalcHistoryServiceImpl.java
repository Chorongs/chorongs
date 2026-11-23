package chorong.calculator.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.HomeLimitCalcHistoryRequestDTO;
import chorong.calculator.dto.HomeLimitCalcHistoryResponseDTO;
import chorong.calculator.entity.HomeLimitCalcHistory;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.HomeLimitCalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;

/*
 * 내 집 대출한도 계산 기록 저장, 목록, 삭제 (CAL-08)
 * 회원 번호는 세션에서만 받음 (B3) / 저장과 오래된 기록 정리는 한 트랜잭션 (B16)
 */
@Service
@RequiredArgsConstructor
public class HomeLimitCalcHistoryServiceImpl implements HomeLimitCalcHistoryService {

	private static final int MAX_CALCS = 10;	// 회원당 기록 수

	private final HomeLimitCalcHistoryRepository homeLimitCalcHistoryRepository;

	@Override
	@Transactional
	public void saveHomeCalc(Long memberId, HomeLimitCalcHistoryRequestDTO request) {
		// 1. 값 확인 (칸마다 범위는 DTO에서 확인함, 상환 방식은 원리금균등과 원금균등만)
		if (request.getRepayMethod() != RepayMethod.EQUAL_PI && request.getRepayMethod() != RepayMethod.EQUAL_P) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "상환 방식을 확인해 주세요.");
		}

		// 2. 저장
		homeLimitCalcHistoryRepository.save(request.toEntity(memberId, LocalDateTime.now().withNano(0)));

		// 3. 10개 넘으면 가장 오래된 기록부터 삭제
		List<HomeLimitCalcHistory> calcs = homeLimitCalcHistoryRepository.findByMemberIdOrderByHomeIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			homeLimitCalcHistoryRepository.deleteAll(calcs.subList(MAX_CALCS, calcs.size()));
		}
	}

	@Override
	@Transactional(readOnly = true)
	public HomeLimitCalcHistoryResponseDTO getHomeCalcs(Long memberId) {
		List<HomeLimitCalcHistoryResponseDTO.Item> items = homeLimitCalcHistoryRepository
				.findByMemberIdOrderByHomeIdDesc(memberId)
				.stream()
				.map(HomeLimitCalcHistoryResponseDTO.Item::from)
				.toList();
		return new HomeLimitCalcHistoryResponseDTO(items);
	}

	@Override
	@Transactional
	public void deleteHomeCalc(Long memberId, Long homeId) {
		// 남의 기록과 없는 기록은 같은 404
		HomeLimitCalcHistory calc = homeLimitCalcHistoryRepository.findByHomeIdAndMemberId(homeId, memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		homeLimitCalcHistoryRepository.delete(calc);
	}

	@Override
	@Transactional
	public void deleteHomeCalcs(Long memberId) {
		homeLimitCalcHistoryRepository.deleteByMemberId(memberId);
	}
}
