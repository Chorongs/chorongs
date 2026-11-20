package chorong.history.service;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.history.dto.SearchHistoryRequestDTO;
import chorong.history.dto.SearchHistoryResponseDTO;
import chorong.history.entity.SearchHistory;
import chorong.history.repository.SearchHistoryRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/*
 * MEM-09 최근 검색 (API-22), 권한 B3
 * 기대값 출처: be_member.md MEM-09
 *   POST: 같은 label이면 시각만 갱신 (unique member_id + search_label) → 없으면 추가, 10개 넘으면 오래된 것 삭제
 *   GET: 최근 10개 (searchId, searchType, searchLabel, searchCondition, searchedAt)
 *   DELETE: {searchId} 있으면 그 1건 (내 것만, 없거나 남의 것은 404), 없으면 내 기록 전체
 * 명세서에 없는 선택(사용자 결정): 저장 중 unique가 막으면 409 CONFLICT, 전체 삭제는 기록이 없어도 오류 없음
 * type(FILTER, SIMPLE)과 label 길이 검사는 DTO(@Valid)에서 하므로 SearchHistoryControllerTest에서 확인
 */
@ExtendWith(MockitoExtension.class)
class SearchHistoryServiceImplTest {

    private static final Long MEMBER_ID = 1L;
    private static final Long OTHER_MEMBER_ID = 2L;
    private static final Long SEARCH_ID = 100L;
    private static final String LABEL = "근로자 · 생활비 · 신용";
    private static final String CONDITION = "{\"job\":\"근로자\"}";
    private static final LocalDateTime NEWEST = LocalDateTime.of(2026, 11, 20, 12, 0, 0);

    @Mock
    private SearchHistoryRepository searchHistoryRepository;

    @InjectMocks
    private SearchHistoryServiceImpl searchHistoryService;

    // ---------- 기록 POST: 처음 하는 검색 ----------

    @Test
    @DisplayName("처음 하는 검색이면 기록이 한 번 저장된다")
    void saveNewSavesOnce() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        verify(searchHistoryRepository, times(1)).save(any(SearchHistory.class));
    }

    @Test
    @DisplayName("저장되는 기록의 회원 번호는 인자로 받은 회원 번호이다")
    void saveNewMemberId() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        assertThat(savedSearchHistory().getMemberId()).isEqualTo(MEMBER_ID);
    }

    @Test
    @DisplayName("저장되는 기록에 요청의 type이 담긴다")
    void saveNewType() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("SIMPLE", LABEL, CONDITION));

        // Then
        assertThat(savedSearchHistory().getSearchType()).isEqualTo("SIMPLE");
    }

    @Test
    @DisplayName("저장되는 기록에 요청의 label이 담긴다")
    void saveNewLabel() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        assertThat(savedSearchHistory().getSearchLabel()).isEqualTo(LABEL);
    }

    @Test
    @DisplayName("저장되는 기록에 요청의 condition이 담긴다")
    void saveNewCondition() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        assertThat(savedSearchHistory().getSearchCondition()).isEqualTo(CONDITION);
    }

    @Test
    @DisplayName("저장되는 기록에는 검색 시각이 채워진다")
    void saveNewSearchedAt() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        assertThat(savedSearchHistory().getSearchedAt()).isNotNull();
    }

    @Test
    @DisplayName("같은 label이 다른 회원에게 있어도 내 기록으로 새로 저장된다")
    void saveSameLabelOfOtherMemberSavesNew() {
        // Given
        when(searchHistoryRepository.findByMemberIdAndSearchLabel(MEMBER_ID, LABEL)).thenReturn(Optional.empty());
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        verify(searchHistoryRepository, never()).findByMemberIdAndSearchLabel(OTHER_MEMBER_ID, LABEL);
        assertThat(savedSearchHistory().getMemberId()).isEqualTo(MEMBER_ID);
    }

    // ---------- 기록 POST: 같은 label (시각만 갱신) ----------

    @Test
    @DisplayName("같은 label이면 검색 시각만 새로 갱신된다")
    void saveExistingUpdatesSearchedAt() {
        // Given
        SearchHistory existing = historyOf(SEARCH_ID, MEMBER_ID, LABEL, NEWEST.minusDays(3));
        when(searchHistoryRepository.findByMemberIdAndSearchLabel(MEMBER_ID, LABEL)).thenReturn(Optional.of(existing));

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        assertThat(existing.getSearchedAt()).isAfter(NEWEST.minusDays(3));
    }

    @Test
    @DisplayName("같은 label이면 label, type, condition은 바뀌지 않는다")
    void saveExistingKeepsOtherFields() {
        // Given
        SearchHistory existing = historyOf(SEARCH_ID, MEMBER_ID, LABEL, NEWEST.minusDays(3));
        when(searchHistoryRepository.findByMemberIdAndSearchLabel(MEMBER_ID, LABEL)).thenReturn(Optional.of(existing));

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("SIMPLE", LABEL, "{\"other\":1}"));

        // Then
        assertThat(existing.getSearchLabel()).isEqualTo(LABEL);
        assertThat(existing.getSearchType()).isEqualTo("FILTER");
        assertThat(existing.getSearchCondition()).isEqualTo(CONDITION);
    }

    @Test
    @DisplayName("같은 label이면 새 기록을 저장하지 않는다")
    void saveExistingDoesNotSave() {
        // Given
        SearchHistory existing = historyOf(SEARCH_ID, MEMBER_ID, LABEL, NEWEST.minusDays(3));
        when(searchHistoryRepository.findByMemberIdAndSearchLabel(MEMBER_ID, LABEL)).thenReturn(Optional.of(existing));

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        verify(searchHistoryRepository, never()).save(any(SearchHistory.class));
    }

    @Test
    @DisplayName("같은 label이면 개수도 세지 않고 아무것도 지우지 않는다")
    void saveExistingDoesNotCountOrDelete() {
        // Given
        SearchHistory existing = historyOf(SEARCH_ID, MEMBER_ID, LABEL, NEWEST.minusDays(3));
        when(searchHistoryRepository.findByMemberIdAndSearchLabel(MEMBER_ID, LABEL)).thenReturn(Optional.of(existing));

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        verify(searchHistoryRepository, never()).countByMemberId(MEMBER_ID);
        verify(searchHistoryRepository, never()).delete(any(SearchHistory.class));
    }

    // ---------- 기록 POST: 10개 유지 ----------

    @Test
    @DisplayName("기록이 9개이면 새로 저장해도 지우지 않는다")
    void saveWithNineDoesNotDelete() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(9L);

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        verify(searchHistoryRepository, never()).delete(any(SearchHistory.class));
        verify(searchHistoryRepository, times(1)).save(any(SearchHistory.class));
    }

    @Test
    @DisplayName("기록이 10개일 때 새로 저장하면 가장 오래된 것을 지운다")
    void saveWithTenDeletesOldest() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(10L);
        SearchHistory oldest = historyOf(7L, MEMBER_ID, "가장 오래된 검색", NEWEST.minusDays(30));
        when(searchHistoryRepository.findFirstByMemberIdOrderBySearchedAtAsc(MEMBER_ID)).thenReturn(Optional.of(oldest));

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        verify(searchHistoryRepository, times(1)).delete(oldest);
        verify(searchHistoryRepository, times(1)).save(any(SearchHistory.class));
    }

    @Test
    @DisplayName("10개를 넘은 상태여도 오래된 것 하나를 지우고 새로 저장한다")
    void saveWithElevenDeletesOnlyOne() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(11L);
        SearchHistory oldest = historyOf(7L, MEMBER_ID, "가장 오래된 검색", NEWEST.minusDays(30));
        when(searchHistoryRepository.findFirstByMemberIdOrderBySearchedAtAsc(MEMBER_ID)).thenReturn(Optional.of(oldest));

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        verify(searchHistoryRepository, times(1)).delete(any(SearchHistory.class));
    }

    @Test
    @DisplayName("오래된 것을 먼저 지운 다음 새 기록을 저장한다")
    void saveDeletesBeforeSave() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(10L);
        SearchHistory oldest = historyOf(7L, MEMBER_ID, "가장 오래된 검색", NEWEST.minusDays(30));
        when(searchHistoryRepository.findFirstByMemberIdOrderBySearchedAtAsc(MEMBER_ID)).thenReturn(Optional.of(oldest));

        // When
        searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION));

        // Then
        InOrder order = inOrder(searchHistoryRepository);
        order.verify(searchHistoryRepository).delete(oldest);
        order.verify(searchHistoryRepository).save(any(SearchHistory.class));
    }

    @Test
    @DisplayName("동시 요청으로 DB unique가 막으면 CONFLICT(409)")
    void saveUniqueViolation() {
        // Given
        givenNoExistingRecord();
        when(searchHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(0L);
        when(searchHistoryRepository.save(any(SearchHistory.class))).thenThrow(new DataIntegrityViolationException("unique"));

        // When, Then
        assertThatThrownBy(() -> searchHistoryService.saveSearchHistory(MEMBER_ID, request("FILTER", LABEL, CONDITION)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.CONFLICT));
    }

    // ---------- 목록 GET ----------

    @Test
    @DisplayName("목록은 최근 검색 순서 그대로 담긴다 (첫 번째가 가장 최근)")
    void getKeepsOrder() {
        // Given
        List<SearchHistory> histories = histories(3);
        when(searchHistoryRepository.findByMemberIdOrderBySearchedAtDesc(MEMBER_ID)).thenReturn(histories);

        // When
        List<SearchHistoryResponseDTO> result = searchHistoryService.getSearchHistories(MEMBER_ID);

        // Then
        assertThat(result).extracting(SearchHistoryResponseDTO::getSearchId)
                .containsExactly(histories.get(0).getSearchId(), histories.get(1).getSearchId(),
                        histories.get(2).getSearchId());
    }

    @Test
    @DisplayName("한 줄에 searchId, searchType, searchLabel, searchCondition, searchedAt이 담긴다")
    void getMapsAllFields() {
        // Given
        SearchHistory history = historyOf(SEARCH_ID, MEMBER_ID, LABEL, NEWEST);
        when(searchHistoryRepository.findByMemberIdOrderBySearchedAtDesc(MEMBER_ID)).thenReturn(List.of(history));

        // When
        SearchHistoryResponseDTO row = searchHistoryService.getSearchHistories(MEMBER_ID).get(0);

        // Then
        assertThat(row.getSearchId()).isEqualTo(SEARCH_ID);
        assertThat(row.getSearchType()).isEqualTo("FILTER");
        assertThat(row.getSearchLabel()).isEqualTo(LABEL);
        assertThat(row.getSearchCondition()).isEqualTo(CONDITION);
        assertThat(row.getSearchedAt()).isEqualTo(NEWEST);
    }

    @Test
    @DisplayName("기록이 10개이면 10개가 모두 담긴다")
    void getTen() {
        // Given
        when(searchHistoryRepository.findByMemberIdOrderBySearchedAtDesc(MEMBER_ID)).thenReturn(histories(10));

        // When
        List<SearchHistoryResponseDTO> result = searchHistoryService.getSearchHistories(MEMBER_ID);

        // Then
        assertThat(result).hasSize(10);
    }

    @Test
    @DisplayName("기록이 없으면 빈 목록이다 (null이 아니다)")
    void getEmpty() {
        // Given
        when(searchHistoryRepository.findByMemberIdOrderBySearchedAtDesc(MEMBER_ID)).thenReturn(List.of());

        // When
        List<SearchHistoryResponseDTO> result = searchHistoryService.getSearchHistories(MEMBER_ID);

        // Then
        assertThat(result).isNotNull().isEmpty();
    }

    @Test
    @DisplayName("목록은 인자로 받은 회원 번호로만 조회한다 (B3)")
    void getUsesGivenMemberId() {
        // Given
        when(searchHistoryRepository.findByMemberIdOrderBySearchedAtDesc(MEMBER_ID)).thenReturn(List.of());

        // When
        searchHistoryService.getSearchHistories(MEMBER_ID);

        // Then
        verify(searchHistoryRepository).findByMemberIdOrderBySearchedAtDesc(MEMBER_ID);
        verify(searchHistoryRepository, never()).findByMemberIdOrderBySearchedAtDesc(OTHER_MEMBER_ID);
    }

    // ---------- 한 건 삭제 ----------

    @Test
    @DisplayName("내 기록이면 그 1건을 삭제한다")
    void deleteOneDeletes() {
        // Given
        SearchHistory mine = historyOf(SEARCH_ID, MEMBER_ID, LABEL, NEWEST);
        when(searchHistoryRepository.findByMemberIdAndSearchId(MEMBER_ID, SEARCH_ID)).thenReturn(Optional.of(mine));

        // When
        searchHistoryService.deleteSearchHistory(MEMBER_ID, SEARCH_ID);

        // Then
        verify(searchHistoryRepository, times(1)).delete(mine);
    }

    @Test
    @DisplayName("없는 기록이면 404")
    void deleteOneNotFound() {
        // Given
        when(searchHistoryRepository.findByMemberIdAndSearchId(MEMBER_ID, SEARCH_ID)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> searchHistoryService.deleteSearchHistory(MEMBER_ID, SEARCH_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("없는 기록이면 아무것도 삭제하지 않는다")
    void deleteOneNotFoundDeletesNothing() {
        // Given
        when(searchHistoryRepository.findByMemberIdAndSearchId(MEMBER_ID, SEARCH_ID)).thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> searchHistoryService.deleteSearchHistory(MEMBER_ID, SEARCH_ID))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(searchHistoryRepository, never()).delete(any(SearchHistory.class));
    }

    @Test
    @DisplayName("남의 기록 번호로 지우면 같은 404이고 남의 기록은 삭제되지 않는다 (B3)")
    void deleteOthersRecordNotDeleted() {
        // Given: 남의 searchId는 내 회원 번호로 찾으면 나오지 않는다
        when(searchHistoryRepository.findByMemberIdAndSearchId(MEMBER_ID, 555L)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> searchHistoryService.deleteSearchHistory(MEMBER_ID, 555L))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
        verify(searchHistoryRepository, never()).delete(any(SearchHistory.class));
    }

    @Test
    @DisplayName("한 건 삭제는 회원 번호와 기록 번호를 함께 넣어 찾는다 (B3)")
    void deleteOneLooksUpWithMemberId() {
        // Given
        SearchHistory mine = historyOf(SEARCH_ID, MEMBER_ID, LABEL, NEWEST);
        when(searchHistoryRepository.findByMemberIdAndSearchId(MEMBER_ID, SEARCH_ID)).thenReturn(Optional.of(mine));

        // When
        searchHistoryService.deleteSearchHistory(MEMBER_ID, SEARCH_ID);

        // Then
        verify(searchHistoryRepository).findByMemberIdAndSearchId(MEMBER_ID, SEARCH_ID);
        verify(searchHistoryRepository, never()).findById(any());
        verify(searchHistoryRepository, never()).deleteById(any());
    }

    // ---------- 전체 삭제 ----------

    @Test
    @DisplayName("전체 삭제는 내 기록 전체를 삭제한다")
    void deleteAllDeletesMine() {
        // Given
        List<SearchHistory> mine = histories(3);
        when(searchHistoryRepository.findByMemberIdOrderBySearchedAtDesc(MEMBER_ID)).thenReturn(mine);

        // When
        searchHistoryService.deleteSearchHistories(MEMBER_ID);

        // Then
        verify(searchHistoryRepository).deleteAll(mine);
    }

    @Test
    @DisplayName("전체 삭제는 인자로 받은 회원 번호의 기록만 찾는다 (B3)")
    void deleteAllUsesGivenMemberId() {
        // Given
        when(searchHistoryRepository.findByMemberIdOrderBySearchedAtDesc(MEMBER_ID)).thenReturn(List.of());

        // When
        searchHistoryService.deleteSearchHistories(MEMBER_ID);

        // Then
        verify(searchHistoryRepository).findByMemberIdOrderBySearchedAtDesc(MEMBER_ID);
        verify(searchHistoryRepository, never()).findByMemberIdOrderBySearchedAtDesc(OTHER_MEMBER_ID);
    }

    @Test
    @DisplayName("지울 기록이 없어도 오류 없이 끝난다")
    void deleteAllWithNoRecords() {
        // Given
        when(searchHistoryRepository.findByMemberIdOrderBySearchedAtDesc(MEMBER_ID)).thenReturn(List.of());

        // When, Then
        assertThatCode(() -> searchHistoryService.deleteSearchHistories(MEMBER_ID)).doesNotThrowAnyException();
    }

    // ---------- 도우미 ----------

    // 같은 label의 기존 기록이 없는 상태
    private void givenNoExistingRecord() {
        when(searchHistoryRepository.findByMemberIdAndSearchLabel(MEMBER_ID, LABEL)).thenReturn(Optional.empty());
    }

    // 요청 DTO
    private SearchHistoryRequestDTO request(String type, String label, String condition) {
        SearchHistoryRequestDTO dto = new SearchHistoryRequestDTO();
        dto.setType(type);
        dto.setLabel(label);
        dto.setCondition(condition);
        return dto;
    }

    private SearchHistory historyOf(Long searchId, Long memberId, String label, LocalDateTime searchedAt) {
        return SearchHistory.builder().searchId(searchId).memberId(memberId).searchType("FILTER")
                .searchLabel(label).searchCondition(CONDITION).searchedAt(searchedAt).build();
    }

    // 최근 순서(첫 번째가 가장 최근)로 count개
    private List<SearchHistory> histories(int count) {
        List<SearchHistory> list = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            list.add(historyOf(SEARCH_ID + i, MEMBER_ID, "검색 " + i, NEWEST.minusHours(i)));
        }
        return list;
    }

    // save에 넘어간 SearchHistory를 꺼낸다
    private SearchHistory savedSearchHistory() {
        ArgumentCaptor<SearchHistory> captor = ArgumentCaptor.forClass(SearchHistory.class);
        verify(searchHistoryRepository).save(captor.capture());
        return captor.getValue();
    }
}
