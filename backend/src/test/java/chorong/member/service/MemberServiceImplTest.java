package chorong.member.service;

import chorong.history.repository.CompareHistoryRepository;
import chorong.history.repository.RecentViewRepository;
import chorong.member.dto.MySummaryResponseDTO;
import chorong.wish.repository.WishRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/*
 * MEM-13 MY 요약 (API-51), 권한 B3
 * 기대값 출처: be_member.md MEM-13
 *   응답 wishCount, recentViewCount, compareCount, calcCount / 세션 회원 번호로 테이블 4개 개수 세기 (B3)
 *   찜 개수는 판매 종료, 숨김 상품 포함 (상품 상태와 상관없이 회원의 찜 전체)
 * 명세서와 다른 곳(사용자 결정): calcCount는 CHORONG-48(계산 기록) 병합 전까지 임시로 0
 */
@ExtendWith(MockitoExtension.class)
class MemberServiceImplTest {

    private static final Long MEMBER_ID = 1L;
    private static final Long OTHER_MEMBER_ID = 2L;

    @Mock
    private WishRepository wishRepository;

    @Mock
    private RecentViewRepository recentViewRepository;

    @Mock
    private CompareHistoryRepository compareHistoryRepository;

    @InjectMocks
    private MemberServiceImpl memberService;

    @Test
    @DisplayName("wishCount는 찜 개수이다")
    void wishCount() {
        // Given
        givenCounts(3L, 4L, 5L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getWishCount()).isEqualTo(3L);
    }

    @Test
    @DisplayName("recentViewCount는 최근 본 대출 개수이다")
    void recentViewCount() {
        // Given
        givenCounts(3L, 4L, 5L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getRecentViewCount()).isEqualTo(4L);
    }

    @Test
    @DisplayName("compareCount는 비교 내역 개수이다")
    void compareCount() {
        // Given
        givenCounts(3L, 4L, 5L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getCompareCount()).isEqualTo(5L);
    }

    @Test
    @DisplayName("계산 기록이 아직 연결되지 않아 calcCount는 임시로 0이다")
    void calcCountTemporarilyZero() {
        // Given
        givenCounts(3L, 4L, 5L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getCalcCount()).isZero();
    }

    @Test
    @DisplayName("기록이 하나도 없으면 개수는 모두 0이다")
    void allZero() {
        // Given
        givenCounts(0L, 0L, 0L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getWishCount()).isZero();
        assertThat(result.getRecentViewCount()).isZero();
        assertThat(result.getCompareCount()).isZero();
        assertThat(result.getCalcCount()).isZero();
    }

    @Test
    @DisplayName("개수는 인자로 받은 회원 번호로만 센다 (B3)")
    void countsOnlyWithGivenMemberId() {
        // Given
        givenCounts(3L, 4L, 5L);

        // When
        memberService.getMySummary(MEMBER_ID);

        // Then
        verify(wishRepository).countByMemberId(MEMBER_ID);
        verify(recentViewRepository).countByMemberId(MEMBER_ID);
        verify(compareHistoryRepository).countByMemberId(MEMBER_ID);
        verify(wishRepository, never()).countByMemberId(OTHER_MEMBER_ID);
        verify(recentViewRepository, never()).countByMemberId(OTHER_MEMBER_ID);
        verify(compareHistoryRepository, never()).countByMemberId(OTHER_MEMBER_ID);
    }

    // ---------- 도우미 ----------

    // 세 리포지토리가 회원의 개수를 돌려주는 상태
    private void givenCounts(long wish, long recentView, long compare) {
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(wish);
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(recentView);
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(compare);
    }
}
