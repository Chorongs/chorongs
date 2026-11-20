package chorong.admin.batch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import chorong.admin.service.AdminAutoClosedService;
import lombok.RequiredArgsConstructor;

/*
 * BAT-02 매일 06:00 자동 내림: 공시 종료일이 지난 게시 상품을 판매 종료로
 * 처리(한 트랜잭션, 캐시 비우기)는 AdminAutoClosedService, 여기는 시각에 부르고 결과만 로그
 * 실패하면 로그를 남기고 다음 날 다시
 */
@Component
@RequiredArgsConstructor
public class AutoCloseBatch {

	private static final Logger log = LoggerFactory.getLogger(AutoCloseBatch.class);

	private final AdminAutoClosedService adminAutoClosedService;

	@Scheduled(cron = "0 0 6 * * *", zone = "Asia/Seoul")
	public void run() {
		try {
			int closed = adminAutoClosedService.closeExpiredProducts();
			log.info("자동 내림 {}건", closed);
		} catch (RuntimeException e) {
			log.error("자동 내림 실패, 다음 날 다시 실행", e);
		}
	}
}
