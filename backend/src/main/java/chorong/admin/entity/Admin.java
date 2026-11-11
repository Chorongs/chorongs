package chorong.admin.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
 * admin 테이블 (관리자 계정)
 * 값은 생성자, 변경 메서드로만 바꿈 (@Setter 안 씀) -> 가입, 승인 등 메서드는 그 기능 담당이 추가
 */
@Entity
@Table(name = "admin")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Admin {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "admin_id")
	private Long adminId;

	@Column(name = "admin_email")
	private String adminEmail;			// 탈퇴하면 비움 (null)

	@Column(name = "admin_name")
	private String adminName;

	@Enumerated(EnumType.STRING)
	@Column(name = "admin_role")
	private AdminRole adminRole;		// APPROVER, MANAGER

	@Enumerated(EnumType.STRING)
	@Column(name = "admin_status")
	private AdminStatus adminStatus;	// PENDING, ACTIVE, REMOVED

	@Column(name = "fail_count")
	private Integer failCount;			// 로그인 토큰 연속 실패 횟수

	@Column(name = "locked_until")
	private LocalDateTime lockedUntil;	// 잠금 해제 시각

	@Column(name = "approved_by")
	private Long approvedBy;			// 승인한 승인권자 번호

	@Column(name = "requested_at")
	private LocalDateTime requestedAt;

	@Column(name = "approved_at")
	private LocalDateTime approvedAt;

	@Column(name = "last_login_at")
	private LocalDateTime lastLoginAt;

	@Column(name = "removed_at")
	private LocalDateTime removedAt;
}
