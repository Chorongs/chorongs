package chorong.member.repository;

import chorong.member.entity.Member;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByLoginTypeAndSocialId(String upperCase, String socialId);

    // 회원 기록 저장 때 회원 행 잠금 (SELECT ... FOR UPDATE, B9): 같은 회원의 저장은 트랜잭션이 끝날 때까지 차례로 처리됨
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Member> findLockedByMemberId(Long memberId);
}
