package chorong.common.client;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.RestClientResponseException;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * FastAPI 오류 응답 → ErrorCode 변환 테스트 (EXT-05 'Spring 변환' 규칙)
 * 서버 없이 FastAPI가 보내는 상태 코드와 본문만 만들어 확인
 */
class FastApiClientTest {

	/** FastAPI 오류 응답 흉내: 상태 코드 + {"detail": ...} 본문 */
	private RestClientResponseException fastApiError(int status, String body) {
		return new RestClientResponseException("FastAPI", HttpStatusCode.valueOf(status), "", null,
				body.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
	}

	@Test
	void 기준_버전이_다르면_VERSION_CONFLICT() {
		// Given
		RestClientResponseException e = fastApiError(409, "{\"detail\":\"VERSION_CONFLICT\"}");
		// When
		BusinessException result = FastApiClient.toBusinessException(e);
		// Then
		assertEquals(ErrorCode.VERSION_CONFLICT, result.getErrorCode());
	}

	@Test
	void 진행_중_작업이_있으면_CONFLICT와_불러오는_중_문구() {
		// Given
		RestClientResponseException e = fastApiError(409, "{\"detail\":\"IMPORT_RUNNING\"}");
		// When
		BusinessException result = FastApiClient.toBusinessException(e);
		// Then
		assertEquals(ErrorCode.CONFLICT + FastApiClient.MSG_IMPORT_RUNNING,
				result.getErrorCode() + result.getMessage());
	}

	@Test
	void 작업이_24시간_지났으면_CONFLICT와_24시간_문구() {
		// Given
		RestClientResponseException e = fastApiError(409, "{\"detail\": \"IMPORT_EXPIRED\"}");
		// When
		BusinessException result = FastApiClient.toBusinessException(e);
		// Then
		assertEquals(ErrorCode.CONFLICT + FastApiClient.MSG_IMPORT_EXPIRED,
				result.getErrorCode() + result.getMessage());
	}

	@Test
	void 확인_필요가_섞이면_NOT_PUBLISHABLE() {
		// Given
		RestClientResponseException e = fastApiError(422, "{\"detail\":\"NOT_PUBLISHABLE\"}");
		// When
		BusinessException result = FastApiClient.toBusinessException(e);
		// Then
		assertEquals(ErrorCode.NOT_PUBLISHABLE, result.getErrorCode());
	}

	@Test
	void 입력_검사_실패_422는_detail이_목록이라_SERVICE_UNAVAILABLE() {
		// Given
		RestClientResponseException e = fastApiError(422,
				"{\"detail\":[{\"type\":\"missing\",\"loc\":[\"body\",\"admin_id\"]}]}");
		// When
		BusinessException result = FastApiClient.toBusinessException(e);
		// Then
		assertEquals(ErrorCode.SERVICE_UNAVAILABLE, result.getErrorCode());
	}

	@Test
	void 모르는_409_코드와_500은_SERVICE_UNAVAILABLE() {
		// Given
		RestClientResponseException unknown409 = fastApiError(409, "{\"detail\":\"SOMETHING_ELSE\"}");
		RestClientResponseException error500 = fastApiError(500, "Internal Server Error");
		// When
		ErrorCode code409 = FastApiClient.toBusinessException(unknown409).getErrorCode();
		ErrorCode code500 = FastApiClient.toBusinessException(error500).getErrorCode();
		// Then
		assertEquals(ErrorCode.SERVICE_UNAVAILABLE + "" + ErrorCode.SERVICE_UNAVAILABLE, code409 + "" + code500);
	}
}
