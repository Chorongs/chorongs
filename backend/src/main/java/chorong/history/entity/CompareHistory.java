package chorong.history.entity;


import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "compare_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class CompareHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long compareId;
    @NotNull
    @Column(name = "member_id")
    private Long memberId;
    @NotNull
    @Column(name = "product_a_id")
    private Long productAId;
    @NotNull
    @Column(name = "product_b_id")
    private Long productBId;
    @NotNull
    @Column(name = "compared_at")
    private LocalDateTime comparedAt;
}
