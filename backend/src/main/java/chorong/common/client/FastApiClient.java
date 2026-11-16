package chorong.common.client;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import chorong.common.dto.FastApiCleanResponseDTO;
import chorong.common.dto.FastApiScoreRequestDTO;
import chorong.common.dto.FastApiScoreResponseDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;

/*
 * FastAPI 서버 호출 (EXT-05): 주소 fastapi.base-url, 요청마다 Authorization: Bearer 토큰
 * 시간 제한: 연결 3초 (FastAPI가 꺼져 있으면 바로 503) / 응답 기다림: 신용 진단 3초 (B14), 상품 정제 5분
 * 실패(연결 안 됨, 시간 초과, FastAPI 4xx/5xx, 응답 형식 틀림)는 모두 503 SERVICE_UNAVAILABLE
 */
@Component
public class FastApiClient {

	private static final Logger log = LoggerFactory.getLogger(FastApiClient.class);

	private static final Duration TIMEOUT = Duration.ofSeconds(3);
	private static final Duration IMPORT_TIMEOUT = Duration.ofMinutes(5);	// 외부 API 수집 + 정제 (첫 수집 실측 약 1.5분)

	private final RestClient restClient;	// 신용 진단 점수 (응답 3초)
	private final RestClient importClient;	// 상품 정제 (응답 5분)

	public FastApiClient(@Value("${fastapi.base-url}") String baseUrl,
						 @Value("${fastapi.token}") String token) {

		HttpClient httpClient = HttpClient.newBuilder()
				.version(HttpClient.Version.HTTP_1_1)
				.connectTimeout(TIMEOUT)			// 연결이 안 되면 이 시간 뒤 포기
				.build();

		this.restClient = buildClient(baseUrl, token, httpClient, TIMEOUT);
		this.importClient = buildClient(baseUrl, token, httpClient, IMPORT_TIMEOUT);
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

	// 상품 정제: 출처(KINFA, FSS)를 보내면 FastAPI가 수집, 정제, 검증한 결과를 돌려줌 (EXT-01, 02)
	public FastApiCleanResponseDTO cleanProducts(List<String> sources) {
		try {
			FastApiCleanResponseDTO response = importClient.post()
					.uri("/products/import")
					.body(Map.of("sources", sources))
					.retrieve()
					.body(FastApiCleanResponseDTO.class);
			return requireBody(response);
		} catch (RestClientException e) {
			log.warn("FastAPI 상품 정제 호출 실패: {}", e.getClass().getSimpleName());
			throw new BusinessException(ErrorCode.SERVICE_UNAVAILABLE);
		}
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
