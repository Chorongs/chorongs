package chorong.admin.entity;

/*
 * admin.admin_status 코드 값 (DB 값 그대로), 잠김은 상태가 아니라 lockedUntil로 판단
 */
public enum AdminStatus {
	PENDING,	// 승인 대기
	ACTIVE,		// 정상
	REMOVED		// 탈퇴
}
