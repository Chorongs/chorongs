package chorong.history.service;

import chorong.history.dto.RecentViewResponseDTO;

import java.util.List;

/*
 * 최근 본 대출 목록, 기록, 삭제 (MEM-08)
 * 회원당 최근 10개, 이미 있으면 viewed_at만 갱신, 10개 넘으면 오래된 것 삭제 (추가와 정리는 같은 트랜잭션, B16)
 */
public interface RecentViewService {

    // 최근 본 목록 (최근 10개, 본 시각 + 상품 요약)
    List<RecentViewResponseDTO> getRecentViews(Long memberId);

    // 기록 (있으면 viewed_at만 갱신, 없으면 추가 → 10개 넘으면 오래된 것 삭제)
    void saveRecentView(Long memberId, Long productId);

    // 한 건 삭제 (내 기록 중 그 상품 1건)
    void deleteRecentView(Long memberId, Long productId);

    // 전체 삭제 (내 기록 전체)
    void deleteRecentViews(Long memberId);

}
