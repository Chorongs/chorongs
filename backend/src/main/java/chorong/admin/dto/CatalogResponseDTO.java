package chorong.admin.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;

import chorong.product.entity.Source;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 게시 상품 현황 + 메뉴 옆 개수 (ADMIN-04, API-31)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CatalogResponseDTO {
	private List<SourceCountItem> sourceCounts;	// 출처별 게시 상품 수
	private Long currentVersion;				// 마지막 반영 이력 번호 (이력이 없으면 null)
	@JsonFormat(pattern = "yyyy-MM-dd HH:mm")
	private LocalDateTime lastUpdatedAt;		// 마지막 반영 시각 (상세 기획 3-12)
	private Integer autoClosedUncheckedCount;	// 자동 내림 확인 전 개수
	private Integer reportedProductCount;		// 미처리 신고 5건 이상인 상품 수
	private Integer pendingAdminCount;			// 승인 대기 개수 (승인권자만, 관리자는 null)

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class SourceCountItem {
		private Source source;	// KINFA, FSS
		private Integer count;
	}
}
