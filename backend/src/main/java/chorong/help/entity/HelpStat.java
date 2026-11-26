package chorong.help.entity;

import jakarta.persistence.*;
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
    @Enumerated(EnumType.STRING)
    private HelpType targetType;
    @NotNull
    private String targetKey;
    @NotNull
    private int openCount;
    @NotNull
    private int helpfulCount;
    @NotNull
    private int unhelpfulCount;
}
