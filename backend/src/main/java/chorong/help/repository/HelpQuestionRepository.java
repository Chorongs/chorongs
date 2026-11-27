package chorong.help.repository;

import chorong.help.entity.HelpQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HelpQuestionRepository extends JpaRepository<HelpQuestion, Long> {
}
