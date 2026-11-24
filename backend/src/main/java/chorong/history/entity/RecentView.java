package chorong.history.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "recent_view")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class RecentView {
    @Id
    @GeneratedValue(strategy= GenerationType.IDENTITY)
    @Column(name = "view_id")
    private Long viewId;
    @Column(name = "member_id")
    private Long memberId;
    @Column(name = "product_id")
    private Long productId;
    @Column(name = "viewed_at")
    private LocalDateTime viewedAt;

    public void  viewedAtUpdate(LocalDateTime viewedAt) {
        this.viewedAt = viewedAt;
    }
}
