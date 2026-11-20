package chorong.calculator.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.calculator.entity.CalcHistory;

public interface CalcHistoryRepository extends JpaRepository<CalcHistory, Long> {

	// 회원의 기록 전부 (최신 먼저)
	List<CalcHistory> findByMemberIdOrderByCalcIdDesc(Long memberId);

	// 내 기록 1건 (남의 기록, 없는 기록은 비어 있음)
	Optional<CalcHistory> findByCalcIdAndMemberId(Long calcId, Long memberId);

	// 내 기록 전체 삭제
	void deleteByMemberId(Long memberId);
}
