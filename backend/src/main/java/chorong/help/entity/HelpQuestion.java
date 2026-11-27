package chorong.help.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class HelpQuestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long questionId;
    @NotNull
    private String content;
    @NotNull
    @JdbcTypeCode(SqlTypes.CHAR)               // DB 타입이 CHAR라고 알려 줌
    @Column(name = "member_yn", length = 1)
    private String memberYn;
    @NotNull
    @Enumerated(EnumType.STRING)
    private QuestionStatus questionStatus;
    @NotNull
    private LocalDateTime createdAt;
}
