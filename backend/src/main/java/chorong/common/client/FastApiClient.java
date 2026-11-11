package chorong.common.client;

import java.net.http.HttpClient;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/*
 * FastAPI 서버 호출 (EXT-05): 주소 fastapi.base-url, 요청마다 Authorization: Bearer 토큰
 * 시간 제한: 신용 진단 3초 (B14), 실패하면 503 SERVICE_UNAVAILABLE
 * 호출 메서드(상품 정제, 신용 진단 점수)는 EXT-05 담당(CHORONG-72)이 추가
 */
@Component
public class FastApiClient {

	private static final Duration TIMEOUT = Duration.ofSeconds(3);

	// TODO(CHORONG-72): 상품 정제, 신용 진단 점수 호출 메서드에서 restClient 사용 (EXT-05)
	private final RestClient restClient;

	public FastApiClient(@Value("${fastapi.base-url}") String baseUrl,
						 @Value("${fastapi.token}") String token) {

		HttpClient httpClient = HttpClient.newBuilder()
				.version(HttpClient.Version.HTTP_1_1)
				.connectTimeout(TIMEOUT)			// 연결이 안 되면 이 시간 뒤 포기
				.build();

		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
		requestFactory.setReadTimeout(TIMEOUT);		// 연결은 됐는데 응답이 늦으면 이 시간 뒤 포기

		this.restClient = RestClient.builder()
				.baseUrl(baseUrl)
				.defaultHeader("Authorization", "Bearer " + token)
				.requestFactory(requestFactory)
				.build();
	}
}
