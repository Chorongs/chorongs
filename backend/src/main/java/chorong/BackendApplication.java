package chorong;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling	// 매일 자동 내림 (BAT-02), 승인 대기 정리 (BAT-03)
@EnableAsync		// 토큰 메일 보내기를 응답 뒤 다른 스레드에서 (EXT-06, AdminMailServiceImpl @Async)
public class BackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(BackendApplication.class, args);
	}

}
