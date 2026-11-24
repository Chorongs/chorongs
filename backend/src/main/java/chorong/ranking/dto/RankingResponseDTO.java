package chorong.ranking.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import chorong.product.dto.ProductSummaryDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 랭킹 응답 (RANK-01): items (최대 30), total, baseDate
 * 목록 칸에 entity, service 필드의 목록을 담을 때는 List.copyOf(목록)으로 복사해 담는다 (backend/Skills.md, dto 패키지 SpotBugs 제외 구역)
 * TODO: baseDate가 무엇의 날짜인지 정하기 (명세서에 없음), metricValue 타입 확정
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RankingResponseDTO {

	private List<RankingItem> items;
	private int total;
	private LocalDateTime baseDate;

	/** 순위 한 줄: rankNo, product(ProductSummaryDTO), prepayFeeMax(중도상환수수료 최대 %), metricValue(기준 값) */
	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	public static class RankingItem {

		private int rankNo;
		private ProductSummaryDTO product;
		private BigDecimal prepayFeeMax;
		private BigDecimal metricValue;		// rate 연 %, limit 만원, term 개월, views 조회수
	}
}
