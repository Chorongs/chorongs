package chorong.member.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 가입 완료 요청 (MEM-12). needBirth가 false면 생년월일은 안 보냄
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SignupRequestDTO {

    @NotNull
    @AssertTrue
    private Boolean termsAgreed;    // true = 필수 약관 2개 모두 동의

    @Pattern(regexp = "^\\d{4}$")
    private String birthYear;       // YYYY

    @Pattern(regexp = "^(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$")
    private String birthDay;        // MM-DD
}
