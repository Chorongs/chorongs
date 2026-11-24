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

    //탈퇴
    public void withdraw() {
        this.loginType = null;
        this.socialId = null;
        this.memberNickname = "탈퇴한 회원";
        this.birthYear = null;
        this.birthDay = null;
        this.memberStatus = 0;
    }

    // 회원 정보 수정
    public void updateMemberInfo(String memberNickname, String birthYear, String birthDay) {
        this.memberNickname = memberNickname;
        this.birthYear = birthYear;
        this.birthDay = birthDay;
    }
}