package chorong.member.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDateTime;
import java.util.Date;

@Entity
@Getter
@NoArgsConstructor()
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
