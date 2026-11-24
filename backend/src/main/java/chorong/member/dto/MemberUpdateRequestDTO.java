package chorong.member.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 회원 정보 수정 요청 (MEM-11): nickname, birthYear, birthDay (바꿀 것만, 값이 없으면 안 바꿈)
 * 닉네임: 앞뒤 공백 제거 후 2~12자 (직접 작성, 이 클래스에 nickname 필드를 추가)
 * 생년월일: birthYear와 birthDay는 함께 보내야 함 (하나만 보내면 서비스에서 400)
 */
@Data
@NoArgsConstructor
public class MemberUpdateRequestDTO {

    @JsonProperty("nickname")
    private String memberNickname;
    @Pattern(regexp = "^\\d{4}$")
    private String birthYear;       // YYYY
    @Pattern(regexp = "^(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$")
    private String birthDay;        // MM-DD
}
