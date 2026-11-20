package chorong.common.util;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/*
 * 메모리 캐시 한 곳 (B10): 자주 안 바뀌는 응답을 서버 메모리에 보관
 * 각 기능은 put, get만 사용. 상품이 바뀌면(반영, 되돌리기, 자동 내림, 숨기기, 다시 보이기) clearProductCaches()
 *
 * 사용 예: memoryCache.put(MemoryCache.RANKING, "RATE", list);
 *         List<RankingItemDTO> list = (List<RankingItemDTO>) memoryCache.get(MemoryCache.RANKING, "RATE");
 */
@Component
public class MemoryCache {

	// 캐시 칸 이름
	public static final String RECOMMEND = "recommend";		// 추천 후보 상품
	public static final String RANKING = "ranking";			// 랭킹
	public static final String FILTER_CHIP = "filterChip";	// 필터 칩 목록
	public static final String TERM = "term";				// 용어
	public static final String TIP = "tip";					// TIP
	public static final String FAQ = "faq";					// FAQ

	// 캐시 칸 이름 -> (키 -> 값)
	private final Map<String, Map<String, Object>> caches = new ConcurrentHashMap<>();

	/** 값 읽기, 없으면 null */
	public Object get(String cacheName, String key) {
		Map<String, Object> cache = caches.get(cacheName);
		return cache == null ? null : cache.get(key);
	}

	/** 값 넣기 */
	public void put(String cacheName, String key, Object value) {
		caches.computeIfAbsent(cacheName, name -> new ConcurrentHashMap<>()).put(key, value);
	}

	/** 캐시 칸 하나 비우기 */
	public void clear(String cacheName) {
		caches.remove(cacheName);
	}

	/** 상품이 바뀌면 비우는 칸: 추천, 랭킹, 필터 칩, 용어 */
	public void clearProductCaches() {
		clear(RECOMMEND);
		clear(RANKING);
		clear(FILTER_CHIP);
		clear(TERM);
	}

	/**
	 * 트랜잭션 안에서 상품을 바꿀 때 (자동 내림, 다시 게시, 숨기기 등): 커밋이 끝난 뒤에 상품 캐시 비우기
	 * 커밋 전에 비우면 그 틈에 다른 요청이 옛 값을 다시 캐시해 다음 비우기까지 남음 / 되돌려지면(롤백) 안 비움
	 * 트랜잭션 밖에서 부르면 바로 비움 (FastAPI가 커밋한 반영, 되돌리기는 clearProductCaches를 그대로 씀)
	 */
	public void clearProductCachesAfterCommit() {
		if (!TransactionSynchronizationManager.isSynchronizationActive()) {
			clearProductCaches();
			return;
		}
		TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
			@Override
			public void afterCommit() {
				clearProductCaches();
			}
		});
	}
}
