package chorong.help.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class HelpStat {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long statId;
    @NotNull
    private String targetType;
    @NotNull
    private String targetKey;
    @NotNull
    private int openCount;
    @NotNull
    private int helpfulCount;
    @NotNull
    private int unhelpfulCount;
}
