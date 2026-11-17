package chorong.member.dto;

import chorong.member.entity.Member;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 내 정보 응답 (MEM-03, MEM-12). 엔티티를 그대로 내보내지 않음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MemberResponseDTO {

    private String memberNickname;
    private String loginType;   // KAKAO, NAVER
    private String birthYear;   // 'YYYY'
    private String birthDay;    // 'MM-DD'

    public static MemberResponseDTO from(Member member) {
        return new MemberResponseDTO(member.getMemberNickname(), member.getLoginType(),
                member.getBirthYear(), member.getBirthDay());
    }
}
