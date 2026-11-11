package chorong.common.exception;

import org.springframework.http.HttpStatus;

import lombok.AllArgsConstructor;
import lombok.Getter;

/*
 * 실패 응답 목록 (상태 코드 + 기본 문구), 응답 code = 상수 이름
 * 새 code는 명세서 공통 구조 '오류 처리' 줄에 먼저 추가한 뒤 여기에 추가
 */
@Getter
@AllArgsConstructor
public enum ErrorCode {

	// 400
	INVALID_INPUT(HttpStatus.BAD_REQUEST, "입력값을 확인해 주세요."),
	SIGNUP_EXPIRED(HttpStatus.BAD_REQUEST, "가입 시간이 지났습니다. 다시 로그인해 주세요."),

	// 401, 403, 404
	LOGIN_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
	FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
	NOT_FOUND(HttpStatus.NOT_FOUND, "찾을 수 없습니다."),

	// 409 (화면 처리가 다른 것만 따로, 그 밖은 CONFLICT + 기능 명세 문구)
	ALREADY_LIKED(HttpStatus.CONFLICT, "이미 찜한 상품입니다."),
	LIKE_FULL(HttpStatus.CONFLICT, "찜 목록이 가득 찼습니다."),
	ALREADY_REPORTED(HttpStatus.CONFLICT, "이미 신고한 상품입니다."),
	NOT_REPORTABLE(HttpStatus.CONFLICT, "신고할 수 없는 상품입니다."),
	ADMIN_LOGGED_IN(HttpStatus.CONFLICT, "관리자로 로그인 중입니다."),
	VERSION_CONFLICT(HttpStatus.CONFLICT, "내용이 바뀌었습니다. 다시 불러와 주세요."),
	UNHANDLED_REPORTS(HttpStatus.CONFLICT, "처리하지 않은 신고가 있습니다."),
	CONFLICT(HttpStatus.CONFLICT, "지금은 처리할 수 없습니다."),

	// 422, 423, 429
	NOT_PUBLISHABLE(HttpStatus.UNPROCESSABLE_CONTENT, "반영할 수 없는 항목이 있습니다."),
	ADMIN_LOCKED(HttpStatus.LOCKED, "로그인이 잠겼습니다. 잠시 후 다시 시도해 주세요."),
	TOO_MANY_REQUESTS(HttpStatus.TOO_MANY_REQUESTS, "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."),

	// 500, 503
	SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),
	SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "잠시 후 다시 시도해 주세요.");

	private final HttpStatus status;	// 상태 코드
	private final String message;		// 기본 문구
}
