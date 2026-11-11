package chorong.common.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import chorong.common.dto.ApiResponse;

/*
 * 공통 예외 처리: 모든 오류를 ApiResponse.fail + 상태 코드로 응답 (B11)
 * 사용자에게는 정해진 문구만, 상세 원인(SQL, 스택, 경로)은 서버 로그에만
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	/** 기능 코드에서 던진 예외 -> ErrorCode의 상태 코드 그대로 */
	@ExceptionHandler(BusinessException.class)
	public ResponseEntity<ApiResponse<Void>> business(BusinessException e) {
		return toResponse(e.getErrorCode(), e.getMessage());
	}

	/** 입력값 오류 (B2): @Valid 실패, 숫자 아닌 id, 빠진 값, 본문 형식 틀림 -> 400 */
	@ExceptionHandler({
		MethodArgumentNotValidException.class,
		MethodArgumentTypeMismatchException.class,
		MissingServletRequestParameterException.class,
		HttpMessageNotReadableException.class
	})
	public ResponseEntity<ApiResponse<Void>> invalid(Exception e) {
		return toResponse(ErrorCode.INVALID_INPUT, ErrorCode.INVALID_INPUT.getMessage());
	}

	/** 없는 주소 -> 404 (500으로 나가지 않게) */
	@ExceptionHandler(NoResourceFoundException.class)
	public ResponseEntity<ApiResponse<Void>> notFound(NoResourceFoundException e) {
		return toResponse(ErrorCode.NOT_FOUND, ErrorCode.NOT_FOUND.getMessage());
	}

	/** 그 밖의 예상하지 못한 오류 -> 500, 상세는 로그에만 */
	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiResponse<Void>> unexpected(Exception e) {
		log.error("처리 중 오류", e);
		return toResponse(ErrorCode.SERVER_ERROR, ErrorCode.SERVER_ERROR.getMessage());
	}

	private ResponseEntity<ApiResponse<Void>> toResponse(ErrorCode errorCode, String message) {
		return ResponseEntity.status(errorCode.getStatus())
				.body(ApiResponse.fail(errorCode.name(), message));
	}
}
