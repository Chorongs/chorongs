package chorong.member.repository;

import chorong.member.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByLoginTypeAndProviderId(String upperCase, String socialId);
}
