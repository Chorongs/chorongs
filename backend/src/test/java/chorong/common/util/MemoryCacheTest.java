package chorong.common.util;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/*
 * 커밋 뒤에 상품 캐시 비우기 (clearProductCachesAfterCommit, B10)
 * 트랜잭션은 TransactionSynchronizationManager로 흉내 냄 (커밋 = afterCommit 직접 부르기)
 */
class MemoryCacheTest {

	private final MemoryCache memoryCache = new MemoryCache();

	@AfterEach
	void tearDown() {
		if (TransactionSynchronizationManager.isSynchronizationActive()) {
			TransactionSynchronizationManager.clearSynchronization();
		}
	}

	@Test
	void 트랜잭션_밖에서는_바로_비움() {
		// Given
		memoryCache.put(MemoryCache.RANKING, "RATE", "랭킹");

		// When
		memoryCache.clearProductCachesAfterCommit();

		// Then
		assertNull(memoryCache.get(MemoryCache.RANKING, "RATE"));
	}

	@Test
	void 트랜잭션_안에서는_커밋_전에_비우지_않음() {
		// Given
		TransactionSynchronizationManager.initSynchronization();
		memoryCache.put(MemoryCache.RANKING, "RATE", "랭킹");

		// When
		memoryCache.clearProductCachesAfterCommit();

		// Then
		assertNotNull(memoryCache.get(MemoryCache.RANKING, "RATE"));
	}

	@Test
	void 트랜잭션_안에서는_커밋_뒤에_비움() {
		// Given
		TransactionSynchronizationManager.initSynchronization();
		memoryCache.put(MemoryCache.RANKING, "RATE", "랭킹");
		memoryCache.clearProductCachesAfterCommit();

		// When: 커밋
		for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
			synchronization.afterCommit();
		}

		// Then
		assertNull(memoryCache.get(MemoryCache.RANKING, "RATE"));
	}
}
