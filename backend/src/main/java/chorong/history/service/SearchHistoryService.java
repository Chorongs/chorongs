package chorong.history.service;

import chorong.history.dto.SearchHistoryRequestDTO;
import chorong.history.dto.SearchHistoryResponseDTO;

import java.util.List;

/*
 * 최근 검색 목록, 기록, 삭제 (MEM-09)
 * 회원당 최근 10개, 같은 label이면 시각만 갱신 (unique member_id + search_label), 10개 넘으면 오래된 것 삭제
 * type은 FILTER, SIMPLE만 (B8), label 200자, condition 길이 제한 (B2)
 */
public interface SearchHistoryService {

    // 최근 검색 목록 (최근 10개)
    List<SearchHistoryResponseDTO> getSearchHistories(Long memberId);

    // 기록 (같은 label이면 시각만 갱신, 없으면 추가 → 10개 넘으면 오래된 것 삭제)
    void saveSearchHistory(Long memberId ,SearchHistoryRequestDTO searchDTO);

    // 한 건 삭제 (내 기록 중 그 1건, 없거나 남의 기록은 404)
    void deleteSearchHistory(Long memberId, Long searchId);

    // 전체 삭제 (내 기록 전체)
    void deleteSearchHistories(Long memberId);
}
