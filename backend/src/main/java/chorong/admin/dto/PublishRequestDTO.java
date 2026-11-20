package chorong.admin.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 확인 후 사이트에 반영 (ADMIN-04, API-34)
 * itemIds는 개수 제한 없음: 반영은 작업마다 한 번(PUBLISHED)이라, 나눠 보내면 나머지를 반영할 수 없음
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PublishRequestDTO {

	@NotEmpty
	private List<@NotNull Long> itemIds;	// 고른 바뀐 상품 번호 (확인 필요 CHECK는 넣지 않음, 섞이면 422)

	@NotNull
	private Long baseVersion;				// 기준 버전 (진행 확인 응답의 baseVersion 그대로)
}
