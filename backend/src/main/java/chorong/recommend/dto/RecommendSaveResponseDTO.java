package chorong.recommend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 추천 결과 저장 응답 (API-38 POST, 201)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecommendSaveResponseDTO {
	private Long saveId;		// 저장 묶음 번호
}
