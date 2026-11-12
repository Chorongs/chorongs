package chorong.member.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Member {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long memberId;
    private String loginType;
    private String socialId;
    @NotNull
    private String memberNickname;
    private String birthYear;
    private String birthDay;
    @NotNull
    private int memberStatus;
    private LocalDateTime termsAgreedAt;
    @NotNull
    private LocalDateTime createdAt;
}