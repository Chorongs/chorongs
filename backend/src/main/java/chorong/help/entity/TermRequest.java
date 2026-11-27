package chorong.help.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class TermRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long requestId;
    @NotNull
    private String termWord;
    @NotNull
    private Integer requestCount;
    @NotNull
    private LocalDateTime createdAt;
    @NotNull
    private LocalDateTime lastRequestedAt;

    public void addRequest(int addRequestCount, LocalDateTime lastRequestedAt) {
        this.requestCount += addRequestCount;
        this.lastRequestedAt = lastRequestedAt;
    }
}
