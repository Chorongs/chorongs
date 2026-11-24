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
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/*
 * admin 테이블 (관리자 계정)
 * 값은 생성자, 변경 메서드로만 바꿈 (@Setter 안 씀): 가입은 빌더 (AdminJoinRequestDTO.toEntity), 잠금, 로그인, 승인, 역할, 탈퇴는 아래 메서드
 */
@Entity
@Table(name = "admin")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class Admin {

	private static final int MAX_FAIL = 5;			// 5번째 실패면 잠금 (B17)
	private static final long LOCK_MINUTES = 30;	// 잠금 30분

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

	/** 지금 잠겨 있는지 (잠금 끝나는 시각 전이면 잠김) */
	public boolean isLocked(LocalDateTime now) {
		return lockedUntil != null && now.isBefore(lockedUntil);
	}

	/** 잠금 풀기: 30분이 지났을 때, 승인권자 [잠금 풀기] (ADMIN-08) */
	public void unlock() {
		this.failCount = 0;
		this.lockedUntil = null;
	}

	/** 토큰 틀림: 실패 +1, 5번째면 30분 잠금 (ADMIN-03) */
	public void failLogin(LocalDateTime now) {
		this.failCount = failCount + 1;
		if (failCount >= MAX_FAIL) {
			this.lockedUntil = now.plusMinutes(LOCK_MINUTES);
		}
	}

	/** 로그인 성공: 실패 0, 마지막 로그인 기록 (ADMIN-03, 첫 가입자 바로 로그인 ADMIN-07) */
	public void succeedLogin(LocalDateTime now) {
		unlock();
		this.lastLoginAt = now;
	}

	/** 가입 승인: 정상 + 역할 + 승인한 사람, 시각 (ADMIN-08) */
	public void approve(AdminRole adminRole, Long approverId, LocalDateTime now) {
		this.adminStatus = AdminStatus.ACTIVE;
		this.adminRole = adminRole;
		this.approvedBy = approverId;
		this.approvedAt = now;
	}

	/** 역할 바꾸기 (ADMIN-08) */
	public void changeRole(AdminRole adminRole) {
		this.adminRole = adminRole;
	}

	/** 탈퇴, 해제: 상태 REMOVED + 시각, 이메일과 이름 비움, 행은 남김 (ADMIN-09) */
	public void withdraw(LocalDateTime now) {
		this.adminStatus = AdminStatus.REMOVED;
		this.removedAt = now;
		this.adminEmail = null;
		this.adminName = null;
	}
}
