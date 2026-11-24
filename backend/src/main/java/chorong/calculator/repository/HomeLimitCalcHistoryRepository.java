package chorong.calculator.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.calculator.entity.HomeLimitCalcHistory;

public interface HomeLimitCalcHistoryRepository extends JpaRepository<HomeLimitCalcHistory, Long> {

	// 회원의 기록 전부 (최신 먼저)
	List<HomeLimitCalcHistory> findByMemberIdOrderByHomeIdDesc(Long memberId);

	// 내 기록 1건 (남의 기록, 없는 기록은 비어 있음)
	Optional<HomeLimitCalcHistory> findByHomeIdAndMemberId(Long homeId, Long memberId);

	// 내 기록 개수 (MY 요약 MEM-13이 가져다 씀)
	long countByMemberId(Long memberId);

	// 내 기록 전체 삭제 (탈퇴 MEM-07도 가져다 씀)
	void deleteByMemberId(Long memberId);
}
