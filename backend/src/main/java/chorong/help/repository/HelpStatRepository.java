package chorong.help.repository;

import chorong.help.entity.HelpStat;
import chorong.help.entity.HelpType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface HelpStatRepository extends JpaRepository<HelpStat, Long> {
    Optional<HelpStat> findByTargetKeyAndTargetType(String targetKey, HelpType targetType);

    @Modifying
    @Query("update HelpStat set openCount = openCount+1 where targetKey = :targetKey")
    int increaseOpenCount(@Param("targetKey") String targetKey);
}
