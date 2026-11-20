package chorong.history.repository;

import chorong.history.entity.SearchHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SearchHistoryRepository extends JpaRepository<SearchHistory,Long> {
    Optional<SearchHistory> findByMemberIdAndSearchLabel(Long memberId, String searchLabel);
    long countByMemberId(Long memberId);
    Optional<SearchHistory> findFirstByMemberIdOrderBySearchedAtAsc(Long memberId);
    Optional<SearchHistory> findByMemberIdAndSearchId(Long memberId, Long searchId);
    List<SearchHistory> findByMemberIdOrderBySearchedAtDesc(Long memberId);
}
