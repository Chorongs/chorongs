package chorong.recommend.service;

import chorong.recommend.dto.RecommendSaveRequestDTO;
import chorong.recommend.dto.SavedRecommendResponseDTO;

public interface RecommendResultService {

	// 추천 결과 저장 (LOAN-04). 저장 묶음 번호(saveId) 반환, 회원당 10개 넘으면 가장 오래된 묶음 삭제
	Long saveRecommendResult(Long memberId, RecommendSaveRequestDTO request);

	// 내 저장 목록 (최신순, 상품은 지금 정보)
	SavedRecommendResponseDTO getRecommendResults(Long memberId);

	// 내 저장 1개 삭제. 없거나 남의 저장이면 404
	void deleteRecommendResult(Long memberId, Long saveId);

	// 내 저장 전체 삭제
	void deleteRecommendResults(Long memberId);
}
