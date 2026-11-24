package chorong.admin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/*
 * 관리자 가입 인증 토큰 요청 (ADMIN-07, API-45 token)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminJoinTokenRequestDTO {

	@ToString.Exclude
	@NotBlank
	@Email
	@Size(max = 320)
	private String email;

	@NotNull
	@Pattern(regexp = "\\S.{0,18}\\S")
	private String name;	// 화면에 보일 이름 2~20자 (앞뒤 공백 없이)
}
