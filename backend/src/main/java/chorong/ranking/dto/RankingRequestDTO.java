package chorong.ranking.dto;

import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 랭킹 요청 (RANK-01, 02): GET /api/rankings?cat=&metric=&dir=
 * cat    금융권: 빈 값 = 전체, 대분류(은행권/비은행권/정책금융) 또는 세분류(SECTOR 태그 값). 모르는 값 400 (B2)
 * metric rate, limit, term, views 중 하나. 정해진 값만 (B1)
 * dir    asc, desc 중 하나. 정해진 값만 (B1)
 * TODO: 입력 검사 표시(@Pattern 등)는 직접 작성, 코드 값은 문자열 그대로 쓰지 말고 정해진 값(enum)에서 컬럼으로 바꿔 정렬 (B1)
 */
@Data
@NoArgsConstructor
public class RankingRequestDTO {

	private String cat;
	@Pattern(regexp = "rate|limit|term|views")
	private String metric;
	@Pattern(regexp = "asc|desc")
	private String dir;
}
