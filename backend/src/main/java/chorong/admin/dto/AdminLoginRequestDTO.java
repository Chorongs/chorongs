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
 * 관리자 토큰 로그인 (ADMIN-03, API-29 ②)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminLoginRequestDTO {

	@ToString.Exclude
	@NotBlank
	@Email
	@Size(max = 320)
	private String email;

	@ToString.Exclude
	@NotNull
	@Pattern(regexp = "\\d{6}")
	private String token;	// 메일로 받은 숫자 6자리
}
