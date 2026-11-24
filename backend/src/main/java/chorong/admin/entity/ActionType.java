package chorong.admin.entity;

/*
 * product_update_history.action_type 코드 값 (DB 값 그대로)
 */
public enum ActionType {
	INIT,		// 첫 적재
	PUBLISH,	// 불러오기 반영
	AUTO_CLOSE,	// 자동 내림
	HIDE,		// 숨기기
	SHOW,		// 다시 보이기, 다시 게시
	ROLLBACK	// 되돌리기
}
