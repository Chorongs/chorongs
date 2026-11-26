package chorong.calculator.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.ChangeCalcHistoryRequestDTO;
import chorong.calculator.dto.ChangeCalcHistoryResponseDTO;
import chorong.calculator.entity.ChangeCalcHistory;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.ChangeCalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;

/*
 * 갈아타기 계산 기록 저장, 목록, 삭제 (CAL-05)
 * 회원 번호는 세션에서만 받음 (B3) / 저장과 오래된 기록 정리는 한 트랜잭션 (B16)
 */
@Service
@RequiredArgsConstructor
public class ChangeCalcHistoryServiceImpl implements ChangeCalcHistoryService {

	private static final int MAX_CALCS = 10;	// 회원당 기록 수
	private static final String MSG_ALREADY_SAVED = "이미 저장한 계산 기록이에요";	// 같은 기록 다시 저장 409 (B9)

	private final ChangeCalcHistoryRepository changeCalcHistoryRepository;
	private final MemberRepository memberRepository;

	@Override
	@Transactional
	public void saveChangeCalc(Long memberId, ChangeCalcHistoryRequestDTO request) {
		// 1. 값 확인 (칸마다 범위는 DTO에서 확인함, 상환 방식 코드는 여기서)
		if (request.getCurrentRepayMethod() == RepayMethod.GRADUATED
				|| request.getNewRepayMethod() == RepayMethod.GRADUATED) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "상환 방식을 확인해 주세요.");
		}

		// 2. 회원 행 잠금 (B9): 같은 회원의 저장은 한 번에 하나씩 -> 다른 탭, 단말기에서 동시에 눌러도 같은 기록 확인과 10개 정리가 맞음
		memberRepository.findLockedByMemberId(memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));

		// 3. 저장할 모양을 먼저 만들어 내 기록과 비교: 입력 9칸 (지금 대출 4칸, 갈아탈 대출 3칸, 수수료율, 기타 비용)이 모두 같으면 409 (결과 칸, 계산 시각은 비교 안 함)
		ChangeCalcHistory calc = request.toEntity(memberId, LocalDateTime.now().withNano(0));
		if (changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(memberId).stream().anyMatch(saved -> isSameInput(saved, calc))) {
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_SAVED);
		}

		// 4. 저장
		changeCalcHistoryRepository.save(calc);

		// 5. 10개 넘으면 가장 오래된 기록부터 삭제
		List<ChangeCalcHistory> calcs = changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			changeCalcHistoryRepository.deleteAll(calcs.subList(MAX_CALCS, calcs.size()));
		}
	}

	// 같은 기록을 이미 저장했는지 (읽기만 하므로 잠그지 않음, 저장은 잠근 뒤 다시 확인)
	@Override
	@Transactional(readOnly = true)
	public boolean hasSavedChangeCalc(Long memberId, ChangeCalcHistoryRequestDTO request) {
		ChangeCalcHistory calc = request.toEntity(memberId, null);
		return changeCalcHistoryRepository.findByMemberIdOrderByChangeIdDesc(memberId).stream().anyMatch(saved -> isSameInput(saved, calc));
	}

	// 같은 기록인지: 입력 9칸 (지금 대출 4칸, 갈아탈 대출 3칸, 수수료율, 기타 비용)이 모두 같음 (금리는 저장할 때처럼 소수 2자리로 맞춘 toEntity 값끼리)
	private static boolean isSameInput(ChangeCalcHistory a, ChangeCalcHistory b) {
		return a.getCurrentRepayMethod() == b.getCurrentRepayMethod()
				&& Objects.equals(a.getCurrentBalance(), b.getCurrentBalance())
				&& sameNumber(a.getCurrentRate(), b.getCurrentRate())
				&& Objects.equals(a.getCurrentMonths(), b.getCurrentMonths())
				&& a.getNewRepayMethod() == b.getNewRepayMethod()
				&& sameNumber(a.getNewRate(), b.getNewRate())
				&& Objects.equals(a.getNewMonths(), b.getNewMonths())
				&& sameNumber(a.getFeeRate(), b.getFeeRate())
				&& Objects.equals(a.getEtcCost(), b.getEtcCost());
	}

	// 소수 칸 비교: 5.5와 5.50은 같음 (equals는 소수 자리 수까지 봐서 compareTo), 둘 다 null이면 같고 한쪽만 null이면 다름
	private static boolean sameNumber(BigDecimal a, BigDecimal b) {
		return a == null ? b == null : b != null && a.compareTo(b) == 0;
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
