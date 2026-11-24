package chorong.admin.dto;

import java.time.LocalDateTime;

import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import chorong.common.util.AdminUtil;
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
 * 관리자 가입 신청 (ADMIN-07, API-45 join)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AdminJoinRequestDTO {

	@ToString.Exclude
	@NotBlank
	@Email
	@Size(max = 320)
	private String email;

	@NotNull
	@Pattern(regexp = "\\S.{0,18}\\S")
	private String name;	// 2~20자 (앞뒤 공백 없이)

	@ToString.Exclude
	@NotNull
	@Pattern(regexp = "\\d{6}")
	private String token;	// 가입 인증 메일로 받은 숫자 6자리

	/** 가입 신청 행 (첫 가입자는 ACTIVE + APPROVER, 그 밖은 PENDING + MANAGER) */
	public Admin toEntity(AdminRole adminRole, AdminStatus adminStatus, LocalDateTime now) {
		boolean active = adminStatus == AdminStatus.ACTIVE;
		return Admin.builder()
				.adminEmail(AdminUtil.normalizeEmail(email))
				.adminName(name)
				.adminRole(adminRole)
				.adminStatus(adminStatus)
				.failCount(0)
				.requestedAt(now)
				.approvedAt(active ? now : null)	// 첫 가입자는 승인한 사람 없이 바로 승인
				.build();
	}
}
