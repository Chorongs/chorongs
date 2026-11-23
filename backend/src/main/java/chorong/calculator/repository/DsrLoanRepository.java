package chorong.calculator.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import chorong.calculator.entity.DsrLoan;

public interface DsrLoanRepository extends JpaRepository<DsrLoan, Long> {

	// 여러 계산의 대출 목록을 한 번에 (계산 번호, 입력 순서대로)
	List<DsrLoan> findByDsrIdInOrderByDsrIdAscSortNoAsc(List<Long> dsrIds);

	// 계산 번호들의 대출 행 삭제 (dsr_calc_history보다 먼저)
	void deleteByDsrIdIn(List<Long> dsrIds);

	// 회원의 모든 DSR 계산의 대출 행 삭제 (dsr_calc_history보다 먼저, 탈퇴 MEM-07이 가져다 씀)
	@Modifying
	@Query("DELETE FROM DsrLoan l WHERE l.dsrId IN (SELECT d.dsrId FROM DsrCalcHistory d WHERE d.memberId = :memberId)")
	void deleteByMemberId(@Param("memberId") Long memberId);
}
