package chorong.admin.batch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import chorong.admin.service.AdminJoinService;
import lombok.RequiredArgsConstructor;

/*
 * BAT-03 매일 1번 (04:00) 승인 대기 정리: 신청한 지 14일 지난 PENDING 행 삭제 (개인정보라 오래 남기지 않음)
 * 실패하면 로그를 남기고 다음 날 다시
 */
@Component
@RequiredArgsConstructor
public class PendingAdminCleanupBatch {

	private static final Logger log = LoggerFactory.getLogger(PendingAdminCleanupBatch.class);

	private final AdminJoinService adminJoinService;

	@Scheduled(cron = "0 0 4 * * *", zone = "Asia/Seoul")
	public void run() {
		try {
			int deleted = adminJoinService.cleanUpExpiredRequests();
			log.info("승인 대기 정리 {}건", deleted);
		} catch (RuntimeException e) {
			log.error("승인 대기 정리 실패, 다음 날 다시 실행", e);
		}
	}
}
