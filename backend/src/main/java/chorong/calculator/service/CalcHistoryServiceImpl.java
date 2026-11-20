package chorong.calculator.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.CalcHistoryRequestDTO;
import chorong.calculator.dto.CalcHistoryResponseDTO;
import chorong.calculator.entity.CalcHistory;
import chorong.calculator.entity.RepayMethod;
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
		// 1. 값 확인 (칸마다 범위는 DTO에서 확인함, 기간 목록과 칸 사이 규칙은 여기서)
		validate(request);

		// 2. 저장
		calcHistoryRepository.save(request.toEntity(memberId, LocalDateTime.now().withNano(0)));

		// 3. 10개 넘으면 가장 오래된 기록부터 삭제
		List<CalcHistory> calcs = calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			calcHistoryRepository.deleteAll(calcs.subList(MAX_CALCS, calcs.size()));
		}
	}

	// 칸 사이 규칙 (화면 규칙과 같게): 기간 목록, 거치, 만기일시, 증가율, 중도상환 4칸, 금리 변동 2칸
	// 중도상환액이 남은 원금 이하인지는 상환 계산이 필요해 화면에서만 확인함
	private void validate(CalcHistoryRequestDTO request) {
		int months = request.getLoanMonths();
		if (!LOAN_MONTHS.contains(months)) {
			throw invalid("대출 기간을 확인해 주세요.");
		}
		if (request.getGraceMonths() >= months) {
			throw invalid("거치 기간은 대출 기간보다 짧아야 해요.");
		}
		if (request.getRepayMethod() == RepayMethod.BULLET && request.getGraceMonths() != 0) {
			throw invalid("만기일시는 거치 기간이 없어요.");
		}
		if (request.getGrowthRate() != null && request.getRepayMethod() != RepayMethod.GRADUATED) {
			throw invalid("증가율은 체증식에서만 입력할 수 있어요.");
		}

		boolean[] prepay = {
				request.getPrepayRound() != null, request.getPrepayAmount() != null,
				request.getPrepayFeeRate() != null, request.getPrepayMode() != null };
		if (isPartial(prepay)) {
			throw invalid("중도상환은 회차, 금액, 수수료율, 방식을 모두 입력해 주세요.");
		}
		if (request.getPrepayRound() != null && request.getPrepayRound() > months) {
			throw invalid("중도상환 회차는 대출 기간 안이어야 해요.");
		}

		boolean[] change = { request.getChangeRound() != null, request.getChangeRate() != null };
		if (isPartial(change)) {
			throw invalid("금리 변동은 회차와 변동 후 금리를 모두 입력해 주세요.");
		}
		if (request.getChangeRound() != null && request.getChangeRound() > months) {
			throw invalid("금리 변동 회차는 대출 기간 안이어야 해요.");
		}
	}

	// 칸 묶음이 일부만 채워졌는지 (전부 있거나 전부 없으면 false)
	private static boolean isPartial(boolean[] filled) {
		int count = 0;
		for (boolean one : filled) {
			if (one) {
				count++;
			}
		}
		return count > 0 && count < filled.length;
	}

	private static BusinessException invalid(String message) {
		return new BusinessException(ErrorCode.INVALID_INPUT, message);
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
