package chorong.calculator.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.ReverseCalcHistoryRequestDTO;
import chorong.calculator.dto.ReverseCalcHistoryResponseDTO;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.entity.ReverseCalcHistory;
import chorong.calculator.repository.ReverseCalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;

/*
 * 상환능력 기반 대출 계산 기록 저장, 목록, 삭제 (CAL-07)
 * 회원 번호는 세션에서만 받음 (B3) / 저장과 오래된 기록 정리는 한 트랜잭션 (B16)
 */
@Service
@RequiredArgsConstructor
public class ReverseCalcHistoryServiceImpl implements ReverseCalcHistoryService {

	private static final int MAX_CALCS = 10;	// 회원당 기록 수
	private static final String MSG_ALREADY_SAVED = "이미 저장한 계산 기록이에요";	// 같은 기록 다시 저장 409 (B9)

	private final ReverseCalcHistoryRepository reverseCalcHistoryRepository;
	private final MemberRepository memberRepository;

	@Override
	@Transactional
	public void saveReverseCalc(Long memberId, ReverseCalcHistoryRequestDTO request) {
		// 1. 값 확인 (칸마다 범위는 DTO에서 확인함, 상환 방식 코드는 여기서)
		if (request.getRepayMethod() == RepayMethod.GRADUATED) {
			throw new BusinessException(ErrorCode.INVALID_INPUT, "상환 방식을 확인해 주세요.");
		}

		// 2. 회원 행 잠금 (B9): 같은 회원의 저장은 한 번에 하나씩 -> 다른 탭, 단말기에서 동시에 눌러도 같은 기록 확인과 10개 정리가 맞음
		memberRepository.findLockedByMemberId(memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));

		// 3. 저장할 모양을 먼저 만들어 내 기록과 비교: 입력 4칸 (상환 방식, 매달 갚을 돈, 금리, 기간)이 모두 같으면 409 (결과 칸, 계산 시각은 비교 안 함)
		ReverseCalcHistory calc = request.toEntity(memberId, LocalDateTime.now().withNano(0));
		if (reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(memberId).stream().anyMatch(saved -> isSameInput(saved, calc))) {
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_SAVED);
		}

		// 4. 저장
		reverseCalcHistoryRepository.save(calc);

		// 5. 10개 넘으면 가장 오래된 기록부터 삭제
		List<ReverseCalcHistory> calcs = reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			reverseCalcHistoryRepository.deleteAll(calcs.subList(MAX_CALCS, calcs.size()));
		}
	}

	// 같은 기록을 이미 저장했는지 (읽기만 하므로 잠그지 않음, 저장은 잠근 뒤 다시 확인)
	@Override
	@Transactional(readOnly = true)
	public boolean hasSavedReverseCalc(Long memberId, ReverseCalcHistoryRequestDTO request) {
		ReverseCalcHistory calc = request.toEntity(memberId, null);
		return reverseCalcHistoryRepository.findByMemberIdOrderByReverseIdDesc(memberId).stream().anyMatch(saved -> isSameInput(saved, calc));
	}

	// 같은 기록인지: 입력 4칸 (상환 방식, 매달 갚을 돈, 금리, 기간)이 모두 같음 (금리는 저장할 때처럼 소수 2자리로 맞춘 toEntity 값끼리)
	private static boolean isSameInput(ReverseCalcHistory a, ReverseCalcHistory b) {
		return a.getRepayMethod() == b.getRepayMethod()
				&& Objects.equals(a.getMonthlyPayment(), b.getMonthlyPayment())
				&& sameNumber(a.getInterestRate(), b.getInterestRate())
				&& Objects.equals(a.getLoanMonths(), b.getLoanMonths());
	}

	// 소수 칸 비교: 5.5와 5.50은 같음 (equals는 소수 자리 수까지 봐서 compareTo), 둘 다 null이면 같고 한쪽만 null이면 다름
	private static boolean sameNumber(BigDecimal a, BigDecimal b) {
		return a == null ? b == null : b != null && a.compareTo(b) == 0;
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
