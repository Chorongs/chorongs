package chorong.admin.dto;

import chorong.admin.entity.AdminStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 관리자 가입 신청 결과 (ADMIN-07)
 * ACTIVE = 첫 관리자라 바로 로그인됨 / PENDING = 승인 대기
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminJoinResponseDTO {
	private AdminStatus adminStatus;
}
