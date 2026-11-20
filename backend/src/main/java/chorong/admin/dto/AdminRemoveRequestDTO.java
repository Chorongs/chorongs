package chorong.admin.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/*
 * 관리자 탈퇴 (ADMIN-09) / 확인용으로 내 이메일을 다시 받음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminRemoveRequestDTO {

	@ToString.Exclude
	@NotBlank
	@Email
	@Size(max = 320)
	private String email;
}
