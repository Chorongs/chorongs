package chorong.ranking.service;

import chorong.ranking.dto.RankingRequestDTO;
import chorong.ranking.dto.RankingResponseDTO;

public interface RankingService {

	// 기준별 랭킹, 금융권 필터 (RANK-01, 02). metric, dir, cat이 정해진 값이 아니면 400
	RankingResponseDTO getRanking(RankingRequestDTO request);
}
