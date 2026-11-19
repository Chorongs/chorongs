package chorong.common.client;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import chorong.common.dto.FastApiImportResponseDTO;
import chorong.common.dto.FastApiScoreRequestDTO;
import chorong.common.dto.FastApiScoreResponseDTO;
import chorong.common.dto.FastApiVersionResponseDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * FastAPI 서버 호출 (EXT-05): 주소 fastapi.base-url, 요청마다 Authorization: Bearer 토큰
 * 시간 제한: 연결 3초 (FastAPI가 꺼져 있으면 바로 503) / 응답 기다림: 신용 진단, 불러오기 시작, 진행 확인 3초 (B14), 반영, 되돌리기 5분
 * 실패(연결 안 됨, 시간 초과, 응답 형식 틀림)는 503 SERVICE_UNAVAILABLE
 * FastAPI 4xx 변환 (EXT-05): 409 VERSION_CONFLICT → VERSION_CONFLICT, IMPORT_RUNNING, IMPORT_EXPIRED → CONFLICT (문구는 ADMIN-04),
 *                           422 NOT_PUBLISHABLE → NOT_PUBLISHABLE, 그 밖의 실패 → SERVICE_UNAVAILABLE
 * 불러오기 시작, 반영, 되돌리기 요청 본문은 DTO 없이 Map.of (EXT-05 비고)
 */
@Component
public class FastApiClient {

	private static final Logger log = LoggerFactory.getLogger(FastApiClient.class);

	private static final Duration TIMEOUT = Duration.ofSeconds(3);
	private static final Duration WRITE_TIMEOUT = Duration.ofMinutes(5);	// 반영, 되돌리기 (상품 1,600여 개를 한 트랜잭션으로 씀)

	// FastAPI 오류 본문 {"detail": "코드"}에서 코드 꺼내기 (입력 검사 실패는 detail이 목록이라 안 맞음 → 503)
	private static final Pattern DETAIL = Pattern.compile("\"detail\"\\s*:\\s*\"([A-Z_]+)\"");

	// 409 CONFLICT 문구 (ADMIN-04)
	static final String MSG_IMPORT_RUNNING = "이미 불러오는 중이에요. 끝난 뒤 확인해 주세요";
	static final String MSG_IMPORT_EXPIRED = "불러온 지 24시간이 지났어요. 다시 불러와 주세요";

	private final RestClient restClient;	// 신용 진단 점수, 불러오기 시작, 진행 확인 (응답 3초)
	private final RestClient writeClient;	// 반영, 되돌리기 (응답 5분)

	public FastApiClient(@Value("${fastapi.base-url}") String baseUrl,
						 @Value("${fastapi.token}") String token) {

		HttpClient httpClient = HttpClient.newBuilder()
				.version(HttpClient.Version.HTTP_1_1)
				.connectTimeout(TIMEOUT)			// 연결이 안 되면 이 시간 뒤 포기
				.build();

		this.restClient = buildClient(baseUrl, token, httpClient, TIMEOUT);
		this.writeClient = buildClient(baseUrl, token, httpClient, WRITE_TIMEOUT);
	}

	private static RestClient buildClient(String baseUrl, String token, HttpClient httpClient, Duration readTimeout) {
		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
		requestFactory.setReadTimeout(readTimeout);	// 연결은 됐는데 응답이 늦으면 이 시간 뒤 포기

		return RestClient.builder()
				.baseUrl(baseUrl)
				.defaultHeader("Authorization", "Bearer " + token)
				.requestFactory(requestFactory)
				.build();
	}

	// 불러오기 시작: 출처(KINFA, FSS)와 관리자 번호를 보내면 작업 번호(jobId)만 든 응답을 바로 돌려줌 (ADMIN-04, EXT-01, 02)
	// 수집, 정제, 비교는 FastAPI가 응답 뒤 이어서 함 → 진행은 getImport로 확인 / 진행 중 작업이 있으면 409 CONFLICT
	public FastApiImportResponseDTO startImport(List<String> sources, Long adminId) {
		return call("불러오기 시작", () -> restClient.post()
				.uri("/imports")
				.body(Map.of("sources", sources, "admin_id", adminId))
				.retrieve()
				.body(FastApiImportResponseDTO.class));
	}

	// 진행 확인: 진행 상태, 기준 버전, 출처별 결과, 바뀐 상품 목록 (ADMIN-04)
	public FastApiImportResponseDTO getImport(Long jobId) {
		return call("진행 확인", () -> restClient.get()
				.uri("/imports/{jobId}", jobId)
				.retrieve()
				.body(FastApiImportResponseDTO.class));
	}

	// 반영: 고른 항목 번호, 기준 버전, 관리자 번호 → 새 버전 (ADMIN-04)
	// 409 VERSION_CONFLICT (기준 버전 다름), 409 CONFLICT (24시간 지남, DONE 아님), 422 NOT_PUBLISHABLE (확인 필요 섞임)
	public FastApiVersionResponseDTO publishImport(Long jobId, List<Long> itemIds, Long baseVersion, Long adminId) {
		return call("반영", () -> writeClient.post()
				.uri("/imports/{jobId}/publish", jobId)
				.body(Map.of("item_ids", itemIds, "base_version", baseVersion, "admin_id", adminId))
				.retrieve()
				.body(FastApiVersionResponseDTO.class));
	}

	// 되돌리기: 대상 이력 번호, 기준 버전, 관리자 번호 → 새 버전 (ADMIN-05) / 409 VERSION_CONFLICT
	public FastApiVersionResponseDTO rollbackCatalog(Long historyId, Long baseVersion, Long adminId) {
		return call("되돌리기", () -> writeClient.post()
				.uri("/catalog/rollback")
				.body(Map.of("history_id", historyId, "base_version", baseVersion, "admin_id", adminId))
				.retrieve()
				.body(FastApiVersionResponseDTO.class));
	}

	// 호출 공통: FastAPI 4xx, 5xx는 detail 코드로 ErrorCode 변환, 연결 실패와 시간 초과는 503 (요청 본문은 로그에 안 남김, B8)
	private <T> T call(String what, Supplier<T> request) {
		try {
			return requireBody(request.get());
		} catch (RestClientResponseException e) {
			log.warn("FastAPI {} 실패: 상태 {}, detail {}", what, e.getStatusCode().value(), detailOf(e));
			throw toBusinessException(e);
		} catch (RestClientException e) {
			log.warn("FastAPI {} 호출 실패: {}", what, e.getClass().getSimpleName());
			throw new BusinessException(ErrorCode.SERVICE_UNAVAILABLE);
		}
	}

	// FastAPI 오류 응답 → BusinessException (EXT-05 'Spring 변환' 규칙)
	static BusinessException toBusinessException(RestClientResponseException e) {
		int status = e.getStatusCode().value();
		String detail = detailOf(e);

		if (status == 409) {
			if ("VERSION_CONFLICT".equals(detail)) {
				return new BusinessException(ErrorCode.VERSION_CONFLICT);
			}
			if ("IMPORT_RUNNING".equals(detail)) {
				return new BusinessException(ErrorCode.CONFLICT, MSG_IMPORT_RUNNING);
			}
			if ("IMPORT_EXPIRED".equals(detail)) {
				return new BusinessException(ErrorCode.CONFLICT, MSG_IMPORT_EXPIRED);
			}
		}
		if (status == 422 && "NOT_PUBLISHABLE".equals(detail)) {
			return new BusinessException(ErrorCode.NOT_PUBLISHABLE);
		}
		return new BusinessException(ErrorCode.SERVICE_UNAVAILABLE);
	}

	// 오류 본문의 detail 코드 (없거나 코드 모양이 아니면 null)
	private static String detailOf(RestClientResponseException e) {
		Matcher matcher = DETAIL.matcher(e.getResponseBodyAsString());
		return matcher.find() ? matcher.group(1) : null;
	}

	// 신용 진단 점수: 문항 답을 보내면 점수 (1~1000) + 문항별 점수를 돌려줌 (답, 점수는 로그 금지, B8)
	public FastApiScoreResponseDTO scoreCredit(FastApiScoreRequestDTO request) {
		try {
			FastApiScoreResponseDTO response = restClient.post()
					.uri("/credit/score")
					.body(request)
					.retrieve()
					.body(FastApiScoreResponseDTO.class);
			return requireBody(response);
		} catch (RestClientException e) {
			log.warn("FastAPI 신용 진단 호출 실패: {}", e.getClass().getSimpleName());
			throw new BusinessException(ErrorCode.SERVICE_UNAVAILABLE);
		}
	}

	// 본문이 비어 있으면 503
	private static <T> T requireBody(T body) {
		if (body == null) {
			log.warn("FastAPI 응답 본문 없음");
			throw new BusinessException(ErrorCode.SERVICE_UNAVAILABLE);
		}
		return body;
	}
}
