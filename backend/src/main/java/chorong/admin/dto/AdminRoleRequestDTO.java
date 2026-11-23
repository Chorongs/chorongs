package chorong.admin.dto;

import chorong.admin.entity.AdminRole;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 가입 승인, 역할 바꾸기 (ADMIN-08) / 모르는 값은 본문 형식 오류로 400
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminRoleRequestDTO {

	@NotNull
	private AdminRole role;	// APPROVER 승인권자, MANAGER 관리자
}
