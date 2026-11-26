package chorong.calculator.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import chorong.calculator.entity.HomeOtherLoan;

public interface HomeOtherLoanRepository extends JpaRepository<HomeOtherLoan, Long> {
	// 여러 계산의 다른 대출 목록을 한 번에 (계산 번호, 입력 순서대로)
	List<HomeOtherLoan> findByHomeIdInOrderByHomeIdAscSortNoAsc(List<Long> homeIds);

	// 계산 번호들의 다른 대출 행 삭제 (home_limit_calc_history보다 먼저)
	void deleteByHomeIdIn(List<Long> homeIds);

	// 회원의 모든 집 살 때 대출한도 계산의 다른 대출 행 삭제 (home_limit_calc_history보다 먼저, 탈퇴 MEM-07이 가져다 씀)
	@Modifying
	@Query("DELETE FROM HomeOtherLoan l WHERE l.homeId IN (SELECT h.homeId FROM HomeLimitCalcHistory h WHERE h.memberId = :memberId)")
	void deleteByMemberId(@Param("memberId") Long memberId);
}
