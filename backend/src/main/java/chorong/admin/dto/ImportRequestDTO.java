package chorong.admin.dto;

import java.util.List;

import chorong.product.entity.Source;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 최신 상품 불러오기 시작 (ADMIN-04, API-32)
 * 모르는 출처는 본문 형식 오류로 400, 같은 출처 두 번은 서비스에서 400
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ImportRequestDTO {

	@NotNull
	@Size(min = 1, max = 2)
	private List<@NotNull Source> sources;	// KINFA 서민금융진흥원, FSS 금융감독원
}
