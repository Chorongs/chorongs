package chorong.history.repository;

import chorong.history.entity.CompareHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompareHistoryRepository extends JpaRepository<CompareHistory, Long> {
    //중복데이터가 있는지 확인
    boolean existsByMemberIdAndProductAIdAndProductBId(Long memberId, Long productAId, Long productBId);
    //해당 유저의 기록이 몇 개 저장되어있는지 확인
    long countByMemberId(Long memberId);
    Optional<CompareHistory> findFirstByMemberIdOrderByCompareIdAsc(Long memberId);
    Optional<CompareHistory> findByMemberIdAndCompareId(Long memberId,  Long compareId);
    List<CompareHistory> findByMemberIdOrderByCompareIdDesc(Long memberId);
    void deleteByMemberId(Long memberId);   
}
