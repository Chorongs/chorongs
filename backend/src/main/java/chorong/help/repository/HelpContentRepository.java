package chorong.help.repository;

import chorong.help.entity.HelpContent;
import chorong.help.entity.HelpType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HelpContentRepository extends JpaRepository<HelpContent, Long> {
    List<HelpContent> findByHelpTypeOrderByHelpNoAsc(HelpType helpType);
    Optional<HelpContent> findByHelpTypeAndHelpId(HelpType helpType, Long helpId);
}
