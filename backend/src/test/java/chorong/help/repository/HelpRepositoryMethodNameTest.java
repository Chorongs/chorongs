package chorong.help.repository;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.lang.reflect.Method;

import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.parser.PartTree;

import chorong.help.entity.HelpContent;
import chorong.help.entity.HelpStat;

/*
 * 도움말 Repository의 메서드 이름 검사 (DB 없이)
 * Spring Data는 서버가 켜질 때 메서드 이름의 속성이 엔티티에 있는지 확인하고, 없으면 서버가 켜지지 않는다.
 * 가짜(mock) Repository를 쓰는 테스트는 이 문제를 잡지 못하므로 같은 해석기(PartTree)로 확인한다.
 * @Query가 붙은 메서드는 이름으로 쿼리를 만들지 않으므로 제외 (쿼리 글은 서버를 띄우는 BackendApplicationTests에서 확인됨)
 */
class HelpRepositoryMethodNameTest {

	private static void parseAll(Class<?> repository, Class<?> entity) {
		for (Method method : repository.getDeclaredMethods()) {
			if (method.getAnnotation(Query.class) == null) {
				new PartTree(method.getName(), entity);
			}
		}
	}

	@Test
	void HelpContentRepository_메서드_이름은_엔티티_속성과_맞는다() {
		// Given, When, Then
		assertDoesNotThrow(() -> parseAll(HelpContentRepository.class, HelpContent.class));
	}

	@Test
	void HelpStatRepository_메서드_이름은_엔티티_속성과_맞는다() {
		// Given, When, Then
		assertDoesNotThrow(() -> parseAll(HelpStatRepository.class, HelpStat.class));
	}
}
