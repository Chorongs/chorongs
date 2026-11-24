package chorong.admin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/*
 * 관리자 토큰 요청 (ADMIN-02, API-29 ①)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminTokenRequestDTO {

	@ToString.Exclude
	@NotBlank
	@Email
	@Size(max = 320)
	private String email;	// 등록한 관리자 이메일
}
