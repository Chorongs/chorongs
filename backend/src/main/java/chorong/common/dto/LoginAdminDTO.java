package chorong.common.dto;

import java.time.LocalDateTime;

import chorong.admin.entity.AdminRole;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 세션에 넣는 로그인 관리자 값 (키 SessionConst.LOGIN_ADMIN)
 * loginAt + 2시간이 지나면 AdminInterceptor가 401 (활동해도 연장 없음, B4)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginAdminDTO {
	private Long adminId;			// 관리자 번호
	private String adminName;		// 이름
	private AdminRole adminRole;	// APPROVER 승인권자 / MANAGER 관리자
	private LocalDateTime loginAt;	// 로그인 시각
}
