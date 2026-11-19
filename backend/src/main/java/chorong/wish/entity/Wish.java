package chorong.wish.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "wish")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Wish {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "wish_id")
    private Long wishId;
    @Column(name = "member_id")
    private Long memberId;
    @Column(name = "product_id")
    private Long productId;
    @NotNull
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
