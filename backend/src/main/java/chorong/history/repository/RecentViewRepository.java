package chorong.history.repository;

import chorong.history.entity.RecentView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RecentViewRepository extends JpaRepository<RecentView,Long> {
    Optional<RecentView> findByMemberIdAndProductId(Long memberId, Long productId);
    long countByMemberId(Long memberId);
    Optional<RecentView> findFirstByMemberIdOrderByViewIdAsc(Long memberId);
    List<RecentView> findByMemberIdOrderByViewIdDesc(Long memberId);
    void deleteByMemberId(Long memberId);
}
