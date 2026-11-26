package chorong.ranking.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import chorong.common.dto.ApiResponse;
import chorong.ranking.dto.RankingRequestDTO;
import chorong.ranking.dto.RankingResponseDTO;
import chorong.ranking.service.RankingService;
import lombok.RequiredArgsConstructor;

// 대출 랭킹 (RANK-01, 02): GET /api/rankings?cat=&metric=&dir=  (권한: 모두)

@RestController
@RequestMapping("/api/rankings")
@RequiredArgsConstructor
public class RankingController {

	private final RankingService rankingService;

	@GetMapping
	public ResponseEntity<ApiResponse<RankingResponseDTO>>
	getRanking(@Valid RankingRequestDTO request) {

		return ResponseEntity.ok(ApiResponse.success(rankingService.getRanking(request)));
	}
}
