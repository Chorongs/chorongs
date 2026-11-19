package chorong.wish.repository;

import chorong.wish.entity.Wish;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WishRepository extends JpaRepository<Wish, Long> {
    boolean existsByMemberIdAndProductId(Long memberId, Long productId);
    Long countByMemberId(Long memberId);
    List<Wish> findByMemberIdOrderByCreatedAtDesc(Long memberId);
}
