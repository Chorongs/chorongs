package chorong.history.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "search_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class SearchHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "search_id")
    private Long searchId;
    @Column(name = "member_id")
    private Long memberId;
    @Column(name = "search_type")
    @NotNull
    private String searchType;
    @Column(name = "search_label")
    @NotNull
    private String searchLabel;
    @NotNull
    @Column(name = "search_condition")
    @Lob
    private String searchCondition;
    @NotNull
    @Column(name = "searched_at")
    private LocalDateTime searchedAt;

    public void updateSearchedAt(@NotNull LocalDateTime searchedAt) {
        this.searchedAt = searchedAt;
    }

}
