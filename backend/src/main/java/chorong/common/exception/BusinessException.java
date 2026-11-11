package chorong.common.exception;

import lombok.Getter;

/*
 * 기능 코드(Service, 인터셉터)에서 던지는 예외
 * -> GlobalExceptionHandler가 ErrorCode의 상태 코드 + ApiResponse.fail로 바꿔 응답
 *
 * 사용 예: throw new BusinessException(ErrorCode.NOT_FOUND);
 *         throw new BusinessException(ErrorCode.CONFLICT, "다른 승인권자가 먼저 처리함");
 */
@Getter
public class BusinessException extends RuntimeException {

	private static final long serialVersionUID = 1L;

	private final ErrorCode errorCode;

	// 기본 문구 사용
	public BusinessException(ErrorCode errorCode) {
		super(errorCode.getMessage());
		this.errorCode = errorCode;
	}

	// 기능 명세에 적힌 문구 사용
	public BusinessException(ErrorCode errorCode, String message) {
		super(message);
		this.errorCode = errorCode;
	}
}
