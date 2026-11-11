package chorong.common.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

/*
 * 모든 API가 같이 쓰는 응답 모양 { success, code, message, data }
 * 성공: ApiResponse.success(data) (code 없음)
 * 실패: ApiResponse.fail(code, message) (code = ErrorCode 이름)
 * 204는 본문 없이 보내므로 이 객체를 쓰지 않음
 */
@Getter
@AllArgsConstructor
public class ApiResponse<T> {
	private boolean success;	// 성공 여부
	private String code;		// 실패 코드 (ErrorCode 이름), 성공이면 null
	private String message;		// 실패 안내 문구, 성공이면 null
	private T data;				// 응답 데이터

	// ---- 성공 응답 ----
	public static <T> ApiResponse<T> success(T data) {
		return new ApiResponse<>(true, null, null, data);
	}

	// ---- 실패 응답 ----
	public static <T> ApiResponse<T> fail(String code, String message) {
		return new ApiResponse<>(false, code, message, null);
	}
}
