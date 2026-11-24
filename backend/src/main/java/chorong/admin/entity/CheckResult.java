package chorong.admin.entity;

/*
 * product_snapshot.check_result 코드 값 (자동 내림 확인용, 비면 확인 전)
 */
public enum CheckResult {
	KEEP,	// 확인함 (내림 유지)
	REOPEN	// 다시 게시함
}
