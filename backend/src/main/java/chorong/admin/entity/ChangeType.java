package chorong.admin.entity;

/*
 * product_snapshot.change_type 코드 값 (DB 값 그대로)
 */
public enum ChangeType {
	ADD,	// 새로 추가
	CHANGE,	// 값 변경
	REMOVE,	// 판매 종료 처리 (자동 내림 포함)
	HIDE,	// 숨김
	SHOW	// 다시 보이기, 다시 게시
}
