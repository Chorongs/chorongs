package chorong.help.repository;

import chorong.help.entity.HelpContent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HelpContentRepository extends JpaRepository<HelpContent, Long> {
}
