package chorong.admin.dto;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

/*
 * 관리자 정보, 관리자 목록 1줄 (ADMIN-03 로그인, 세션 확인 / ADMIN-08 목록 / ADMIN-09 내 계정)
 * expiresAt은 세션이 있을 때만 (로그인 + 2시간), 목록에서는 null
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminResponseDTO {
	private Long adminId;
	@ToString.Exclude
	private String adminEmail;
	private String adminName;
	private AdminRole adminRole;		// APPROVER, MANAGER
	private AdminStatus adminStatus;	// PENDING, ACTIVE
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime lockedUntil;	// 지금 잠겨 있을 때만 (풀린 시각이 지났으면 null)
	private Long approvedBy;			// 승인한 승인권자 번호 (첫 가입자 null)
	private String approvedByName;		// 승인한 사람 이름 (탈퇴했으면 null)
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime requestedAt;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime approvedAt;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime lastLoginAt;
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime expiresAt;	// 로그인 만료 시각

	public static AdminResponseDTO from(Admin admin, String approvedByName, LocalDateTime expiresAt) {
		LocalDateTime now = LocalDateTime.now();
		return AdminResponseDTO.builder()
				.adminId(admin.getAdminId())
				.adminEmail(admin.getAdminEmail())
				.adminName(admin.getAdminName())
				.adminRole(admin.getAdminRole())
				.adminStatus(admin.getAdminStatus())
				.lockedUntil(admin.isLocked(now) ? admin.getLockedUntil() : null)
				.approvedBy(admin.getApprovedBy())
				.approvedByName(approvedByName)
				.requestedAt(admin.getRequestedAt())
				.approvedAt(admin.getApprovedAt())
				.lastLoginAt(admin.getLastLoginAt())
				.expiresAt(expiresAt)
				.build();
	}
}
