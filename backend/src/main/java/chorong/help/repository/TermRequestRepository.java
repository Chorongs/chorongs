package chorong.help.repository;

import chorong.help.entity.TermRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface TermRequestRepository extends JpaRepository<TermRequest, Long> {
    Optional<TermRequest> findByTermWord(String word);
}
