package chorong.recommend.service;

import chorong.common.dto.LoginMemberDTO;
import chorong.recommend.dto.EligibilityResponseDTO;
import chorong.recommend.dto.RecommendRequestDTO;
import chorong.recommend.dto.RecommendResponseDTO;

public interface RecommendService {

	// 맞춤 추천 (LOAN-01, 02). loginMember는 비회원이면 null (회원은 세션 생년월일 나이 우선)
	RecommendResponseDTO getRecommendations(RecommendRequestDTO request, LoginMemberDTO loginMember);

	// 내 조건 판정 (LOAN-05). 없거나 게시 상품이 아니면 404
	EligibilityResponseDTO getEligibility(Long productId, RecommendRequestDTO request, LoginMemberDTO loginMember);
}
