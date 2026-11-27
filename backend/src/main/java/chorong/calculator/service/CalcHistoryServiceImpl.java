package chorong.calculator.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.calculator.dto.CalcHistoryRequestDTO;
import chorong.calculator.dto.CalcHistoryResponseDTO;
import chorong.calculator.entity.CalcHistory;
import chorong.calculator.entity.RepayMethod;
import chorong.calculator.repository.CalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.member.repository.MemberRepository;
import lombok.RequiredArgsConstructor;

/*
 * 계산 기록 저장, 목록, 삭제 (CAL-04)
 * 회원 번호는 세션에서만 받음 (B3) / 저장과 오래된 기록 정리는 한 트랜잭션 (B16)
 */
@Service
@RequiredArgsConstructor
public class CalcHistoryServiceImpl implements CalcHistoryService {

	private static final int MAX_CALCS = 10;	// 회원당 기록 수
	private static final String MSG_ALREADY_SAVED = "이미 저장한 계산 기록이에요";	// 같은 기록 다시 저장 409 (B9)
	private static final int MIN_MONTHS = 1;	// 대출 기간 (개월): 화면이 칩 대신 직접 입력 1-600 (2026-11-26 사용자 결정)
	private static final int MAX_MONTHS = 600;

	private final CalcHistoryRepository calcHistoryRepository;
	private final MemberRepository memberRepository;

	@Override
	@Transactional
	public void saveCalc(Long memberId, CalcHistoryRequestDTO request) {
		// 1. 값 확인 (칸마다 범위는 DTO에서 확인함, 기간 범위와 칸 사이 규칙은 여기서)
		validate(request);

		// 2. 회원 행 잠금 (B9): 같은 회원의 저장은 한 번에 하나씩 -> 다른 탭, 단말기에서 동시에 눌러도 같은 기록 확인과 10개 정리가 맞음
		memberRepository.findLockedByMemberId(memberId)
				.orElseThrow(() -> new BusinessException(ErrorCode.LOGIN_REQUIRED));

		// 3. 저장할 모양을 먼저 만들어 내 기록과 비교: 입력 12칸 (기본 5칸 + 옵션 7칸)이 모두 같으면 409 (결과 칸, 계산 시각은 비교 안 함)
		CalcHistory calc = request.toEntity(memberId, LocalDateTime.now().withNano(0));
		if (calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(memberId).stream().anyMatch(saved -> isSameInput(saved, calc))) {
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_SAVED);
		}

		// 4. 저장
		calcHistoryRepository.save(calc);

		// 5. 10개 넘으면 가장 오래된 기록부터 삭제
		List<CalcHistory> calcs = calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(memberId);
		if (calcs.size() > MAX_CALCS) {
			calcHistoryRepository.deleteAll(calcs.subList(MAX_CALCS, calcs.size()));
		}
	}

	// 칸 사이 규칙 (화면 규칙과 같게): 기간 1-600개월, 거치, 만기일시, 증가율, 중도상환 4칸, 금리 변동 2칸
	// 중도상환액이 남은 원금 이하인지는 상환 계산이 필요해 화면에서만 확인함
	private void validate(CalcHistoryRequestDTO request) {
		int months = request.getLoanMonths();
		if (months < MIN_MONTHS || months > MAX_MONTHS) {
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

	// 같은 기록을 이미 저장했는지 (읽기만 하므로 잠그지 않음, 저장은 잠근 뒤 다시 확인)
	@Override
	@Transactional(readOnly = true)
	public boolean hasSavedCalc(Long memberId, CalcHistoryRequestDTO request) {
		CalcHistory calc = request.toEntity(memberId, null);
		return calcHistoryRepository.findByMemberIdOrderByCalcIdDesc(memberId).stream().anyMatch(saved -> isSameInput(saved, calc));
	}

	// 같은 기록인지: 입력 12칸 (기본 5칸 + 옵션 7칸)이 모두 같음 (금리는 저장할 때처럼 소수 2자리로 맞춘 toEntity 값끼리)
	private static boolean isSameInput(CalcHistory a, CalcHistory b) {
		return Objects.equals(a.getLoanAmount(), b.getLoanAmount())
				&& Objects.equals(a.getLoanMonths(), b.getLoanMonths())
				&& sameNumber(a.getInterestRate(), b.getInterestRate())
				&& a.getRepayMethod() == b.getRepayMethod()
				&& Objects.equals(a.getGraceMonths(), b.getGraceMonths())
				&& sameNumber(a.getGrowthRate(), b.getGrowthRate())
				&& Objects.equals(a.getPrepayRound(), b.getPrepayRound())
				&& Objects.equals(a.getPrepayAmount(), b.getPrepayAmount())
				&& sameNumber(a.getPrepayFeeRate(), b.getPrepayFeeRate())
				&& a.getPrepayMode() == b.getPrepayMode()
				&& Objects.equals(a.getChangeRound(), b.getChangeRound())
				&& sameNumber(a.getChangeRate(), b.getChangeRate());
	}

	// 소수 칸 비교: 5.5와 5.50은 같음 (equals는 소수 자리 수까지 봐서 compareTo), 둘 다 null이면 같고 한쪽만 null이면 다름
	private static boolean sameNumber(BigDecimal a, BigDecimal b) {
		return a == null ? b == null : b != null && a.compareTo(b) == 0;
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
