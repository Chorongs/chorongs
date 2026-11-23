package chorong.admin.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 반영, 되돌리기 결과 (ADMIN-04, 05) / version = 새 반영 이력 번호
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PublishResponseDTO {
	private Long version;
}
