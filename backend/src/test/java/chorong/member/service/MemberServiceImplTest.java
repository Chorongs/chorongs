package chorong.member.service;

import chorong.calculator.repository.CalcHistoryRepository;
import chorong.calculator.repository.ChangeCalcHistoryRepository;
import chorong.calculator.repository.DsrCalcHistoryRepository;
import chorong.calculator.repository.DsrLoanRepository;
import chorong.calculator.repository.HomeOtherLoanRepository;
import chorong.calculator.repository.HomeLimitCalcHistoryRepository;
import chorong.calculator.repository.ReverseCalcHistoryRepository;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.credit.entity.DiagnosisReport;
import chorong.credit.repository.DiagnosisReportRepository;
import chorong.history.repository.CompareHistoryRepository;
import chorong.history.repository.RecentViewRepository;
import chorong.history.repository.SearchHistoryRepository;
import chorong.member.dto.MemberResponseDTO;
import chorong.member.dto.MemberUpdateRequestDTO;
import chorong.member.dto.MySummaryResponseDTO;
import chorong.member.entity.Member;
import chorong.member.repository.MemberRepository;
import chorong.recommend.repository.RecommendResultRepository;
import chorong.wish.repository.WishRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/*
 * MEM-13 MY 요약 (API-51), MEM-07 회원 탈퇴 (API-28), 권한 B3
 * 기대값 출처: be_member.md MEM-13, MEM-07
 *   MY 요약: 응답 wishCount, recentViewCount, compareCount, calcCount (명세서) / 세션 회원 번호로 개수 세기 (B3)
 *            찜 개수는 판매 종료, 숨김 상품 포함 (상품 상태와 상관없이 회원의 찜 전체)
 *   탈퇴: 1. 찜, 최근 본, 최근 검색, 비교 내역, 계산 기록, 진단 리포트, 추천 결과 삭제
 *         2. member 닉네임 '탈퇴한 회원', 출생연도, 생일, login_type, social_id null, member_status 0 (행은 남김)
 *         한 번에 처리 @Transactional (B16), 중간 실패 시 전부 되돌림
 *   회원 정보 수정 (MEM-11): 닉네임 앞뒤 공백 제거 후 2~12자, 생년월일 형식, 미래 날짜, 1900년 이전 확인 → 저장,
 *         바꿀 것만 (값이 없으면 안 바꿈), 길이, 형식 오류 400 (B2), 세션 회원 번호로만 수정 (B3), 닉네임 중복 허용
 * 명세서와 다른 곳(계산기 종류가 5개로 나뉜 develop 반영, 명세서 수정 전):
 *   MY 요약: calcCount 하나 대신 calcCount(대출 이자), dsrCount, changeCount(갈아타기), homeLimitCount(내집마련), reversCalcCount(상환능력 역산) 8개 필드
 *   탈퇴: 계산 기록 5종류와 DSR 대출 행(dsr_loan)을 지움. dsr_loan은 dsr_calc_history보다 먼저 지워야 함
 *         (schema.sql: fk_dsr_loan_calc, dsr_loan이 dsr_calc_history를 참조)
 * 명세서에 없는 선택(사용자 결정): 생년월일은 출생연도와 생일을 함께 보내야 함 (하나만 보내면 400), 닉네임 글 중간의 공백은 허용,
 *   만 19세 미만 생년월일로는 수정할 수 없음 (400, 가입과 같은 계산, 사용자 결정으로 명세서 수정 전)
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

    @Mock
    private SearchHistoryRepository searchHistoryRepository;

    @Mock
    private RecommendResultRepository recommendResultRepository;

    @Mock
    private DiagnosisReportRepository diagnosisReportRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private CalcHistoryRepository calcHistoryRepository;

    @Mock
    private DsrCalcHistoryRepository dsrCalcHistoryRepository;

    @Mock
    private ChangeCalcHistoryRepository changeCalcHistoryRepository;

    @Mock
    private HomeLimitCalcHistoryRepository homeLimitCalcHistoryRepository;

    @Mock
    private ReverseCalcHistoryRepository reverseCalcHistoryRepository;

    @Mock
    private DsrLoanRepository dsrLoanRepository;

    @Mock
    private HomeOtherLoanRepository homeOtherLoanRepository;

    @InjectMocks
    private MemberServiceImpl memberService;

    @Test
    @DisplayName("wishCount는 찜 개수이다")
    void wishCount() {
        // Given
        givenCounts(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getWishCount()).isEqualTo(3L);
    }

    @Test
    @DisplayName("recentViewCount는 최근 본 대출 개수이다")
    void recentViewCount() {
        // Given
        givenCounts(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getRecentViewCount()).isEqualTo(4L);
    }

    @Test
    @DisplayName("compareCount는 비교 내역 개수이다")
    void compareCount() {
        // Given
        givenCounts(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getCompareCount()).isEqualTo(5L);
    }

    @Test
    @DisplayName("calcCount는 계산 기록 개수이다")
    void calcCount() {
        // Given
        givenCounts(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getCalcCount()).isEqualTo(6L);
    }

    @Test
    @DisplayName("dsrCount는 DSR 계산 기록 개수이다")
    void dsrCount() {
        // Given
        givenCounts(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getDsrCount()).isEqualTo(7L);
    }

    @Test
    @DisplayName("changeCount는 갈아타기 계산 기록 개수이다")
    void changeCount() {
        // Given
        givenCounts(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getChangeCount()).isEqualTo(8L);
    }

    @Test
    @DisplayName("homeLimitCount는 내집마련 한도 계산 기록 개수이다")
    void homeLimitCount() {
        // Given
        givenCounts(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getHomeLimitCount()).isEqualTo(9L);
    }

    @Test
    @DisplayName("reversCalcCount는 상환능력 역산 계산 기록 개수이다")
    void reverseCount() {
        // Given
        givenCounts(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getReversCalcCount()).isEqualTo(10L);
    }

    @Test
    @DisplayName("기록이 하나도 없으면 개수는 모두 0이다")
    void allZero() {
        // Given
        givenCounts(0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L);

        // When
        MySummaryResponseDTO result = memberService.getMySummary(MEMBER_ID);

        // Then
        assertThat(result.getWishCount()).isZero();
        assertThat(result.getRecentViewCount()).isZero();
        assertThat(result.getCompareCount()).isZero();
        assertThat(result.getCalcCount()).isZero();
        assertThat(result.getDsrCount()).isZero();
        assertThat(result.getChangeCount()).isZero();
        assertThat(result.getHomeLimitCount()).isZero();
        assertThat(result.getReversCalcCount()).isZero();
    }

    @Test
    @DisplayName("개수는 인자로 받은 회원 번호로만 센다 (B3)")
    void countsOnlyWithGivenMemberId() {
        // Given
        givenCounts(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);

        // When
        memberService.getMySummary(MEMBER_ID);

        // Then
        verify(wishRepository).countByMemberId(MEMBER_ID);
        verify(recentViewRepository).countByMemberId(MEMBER_ID);
        verify(compareHistoryRepository).countByMemberId(MEMBER_ID);
        verify(calcHistoryRepository).countByMemberId(MEMBER_ID);
        verify(dsrCalcHistoryRepository).countByMemberId(MEMBER_ID);
        verify(changeCalcHistoryRepository).countByMemberId(MEMBER_ID);
        verify(homeLimitCalcHistoryRepository).countByMemberId(MEMBER_ID);
        verify(reverseCalcHistoryRepository).countByMemberId(MEMBER_ID);
        verify(wishRepository, never()).countByMemberId(OTHER_MEMBER_ID);
        verify(recentViewRepository, never()).countByMemberId(OTHER_MEMBER_ID);
        verify(compareHistoryRepository, never()).countByMemberId(OTHER_MEMBER_ID);
        verify(calcHistoryRepository, never()).countByMemberId(OTHER_MEMBER_ID);
        verify(dsrCalcHistoryRepository, never()).countByMemberId(OTHER_MEMBER_ID);
        verify(changeCalcHistoryRepository, never()).countByMemberId(OTHER_MEMBER_ID);
        verify(homeLimitCalcHistoryRepository, never()).countByMemberId(OTHER_MEMBER_ID);
        verify(reverseCalcHistoryRepository, never()).countByMemberId(OTHER_MEMBER_ID);
    }

    // ---------- 회원 탈퇴 ----------

    @Test
    @DisplayName("탈퇴하면 닉네임이 '탈퇴한 회원'으로 바뀐다")
    void withdrawNickname() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("탈퇴한 회원");
    }

    @Test
    @DisplayName("탈퇴하면 출생연도와 생일이 비워진다")
    void withdrawBirth() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        assertThat(member.getBirthYear()).isNull();
        assertThat(member.getBirthDay()).isNull();
    }

    @Test
    @DisplayName("탈퇴하면 login_type과 social_id가 비워진다")
    void withdrawSocial() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        assertThat(member.getLoginType()).isNull();
        assertThat(member.getSocialId()).isNull();
    }

    @Test
    @DisplayName("탈퇴하면 member_status가 0이 된다")
    void withdrawStatus() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        assertThat(member.getMemberStatus()).isZero();
    }

    @Test
    @DisplayName("탈퇴해도 member 행은 지우지 않는다")
    void withdrawKeepsMemberRow() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(memberRepository, never()).delete(any(Member.class));
        verify(memberRepository, never()).deleteById(anyLong());
    }

    @Test
    @DisplayName("탈퇴하면 찜을 삭제한다")
    void withdrawDeletesWishes() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(wishRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 최근 본 대출을 삭제한다")
    void withdrawDeletesRecentViews() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(recentViewRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 최근 검색을 삭제한다")
    void withdrawDeletesSearchHistories() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(searchHistoryRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 비교 내역을 삭제한다")
    void withdrawDeletesCompareHistories() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(compareHistoryRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 대출 이자 계산 기록을 삭제한다")
    void withdrawDeletesCalcHistories() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(calcHistoryRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 DSR 계산 기록을 삭제한다")
    void withdrawDeletesDsrCalcHistories() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(dsrCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 갈아타기 계산 기록을 삭제한다")
    void withdrawDeletesChangeCalcHistories() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(changeCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 내집마련 한도 계산 기록을 삭제한다")
    void withdrawDeletesHomeLimitCalcHistories() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(homeLimitCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 상환능력 역산 계산 기록을 삭제한다")
    void withdrawDeletesReverseCalcHistories() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(reverseCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 DSR 대출 행을 삭제한다")
    void withdrawDeletesDsrLoans() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(dsrLoanRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("DSR 대출 행은 DSR 계산 기록보다 먼저 지운다 (fk_dsr_loan_calc)")
    void withdrawDeletesDsrLoansBeforeDsrCalcHistories() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        InOrder order = inOrder(dsrLoanRepository, dsrCalcHistoryRepository);
        order.verify(dsrLoanRepository).deleteByMemberId(MEMBER_ID);
        order.verify(dsrCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("집 살 때 대출한도의 다른 대출 행은 계산 기록보다 먼저 지운다 (fk_home_other_loan_calc)")
    void withdrawDeletesHomeOtherLoansBeforeHomeCalcHistories() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        InOrder order = inOrder(homeOtherLoanRepository, homeLimitCalcHistoryRepository);
        order.verify(homeOtherLoanRepository).deleteByMemberId(MEMBER_ID);
        order.verify(homeLimitCalcHistoryRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("탈퇴하면 추천 결과를 삭제한다")
    void withdrawDeletesRecommendResults() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(recommendResultRepository).deleteByMemberId(MEMBER_ID);
    }

    @Test
    @DisplayName("진단 리포트가 있으면 삭제한다")
    void withdrawDeletesDiagnosisReport() {
        // Given
        givenMember(activeMember());
        DiagnosisReport report = mock(DiagnosisReport.class);
        when(diagnosisReportRepository.findByMemberId(MEMBER_ID)).thenReturn(Optional.of(report));

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(diagnosisReportRepository).delete(report);
    }

    @Test
    @DisplayName("진단 리포트가 없어도 오류 없이 탈퇴된다")
    void withdrawWithoutDiagnosisReport() {
        // Given
        Member member = activeMember();
        givenMember(member);
        when(diagnosisReportRepository.findByMemberId(MEMBER_ID)).thenReturn(Optional.empty());

        // When, Then
        assertThatCode(() -> memberService.withdraw(MEMBER_ID)).doesNotThrowAnyException();
        verify(diagnosisReportRepository, never()).delete(any(DiagnosisReport.class));
        assertThat(member.getMemberStatus()).isZero();
    }

    @Test
    @DisplayName("회원이 없으면 404 (NOT_FOUND)")
    void withdrawMemberNotFound() {
        // Given
        when(memberRepository.findById(MEMBER_ID)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> memberService.withdraw(MEMBER_ID))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("회원이 없으면 이용 기록을 하나도 삭제하지 않는다")
    void withdrawMemberNotFoundDeletesNothing() {
        // Given
        when(memberRepository.findById(MEMBER_ID)).thenReturn(Optional.empty());

        // When
        assertThatThrownBy(() -> memberService.withdraw(MEMBER_ID)).isInstanceOf(BusinessException.class);

        // Then
        verifyNoInteractions(wishRepository, recentViewRepository, searchHistoryRepository,
                compareHistoryRepository, recommendResultRepository, diagnosisReportRepository,
                calcHistoryRepository, dsrCalcHistoryRepository, changeCalcHistoryRepository,
                homeLimitCalcHistoryRepository, reverseCalcHistoryRepository, dsrLoanRepository);
    }

    @Test
    @DisplayName("탈퇴는 인자로 받은 회원 번호로만 조회하고 삭제한다 (B3)")
    void withdrawUsesOnlyGivenMemberId() {
        // Given
        givenMember(activeMember());

        // When
        memberService.withdraw(MEMBER_ID);

        // Then
        verify(memberRepository).findById(MEMBER_ID);
        verify(wishRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(recentViewRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(searchHistoryRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(compareHistoryRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(recommendResultRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(calcHistoryRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(dsrLoanRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(dsrCalcHistoryRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(changeCalcHistoryRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(homeLimitCalcHistoryRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(reverseCalcHistoryRepository, never()).deleteByMemberId(OTHER_MEMBER_ID);
        verify(diagnosisReportRepository, never()).findByMemberId(OTHER_MEMBER_ID);
    }

    @Test
    @DisplayName("기록 삭제 중 오류가 나면 예외가 그대로 전해지고 member는 바뀌지 않는다")
    void withdrawFailureLeavesMemberUnchanged() {
        // Given
        Member member = activeMember();
        givenMember(member);
        doThrow(new IllegalStateException("db error")).when(recommendResultRepository).deleteByMemberId(MEMBER_ID);

        // When, Then
        assertThatThrownBy(() -> memberService.withdraw(MEMBER_ID)).isInstanceOf(IllegalStateException.class);
        assertThat(member.getMemberStatus()).isEqualTo(1);
        assertThat(member.getSocialId()).isEqualTo("kakao-123");
    }

    @Test
    @DisplayName("계산 기록 삭제 중 오류가 나면 예외가 그대로 전해지고 member는 바뀌지 않는다")
    void withdrawCalcDeleteFailureLeavesMemberUnchanged() {
        // Given
        Member member = activeMember();
        givenMember(member);
        doThrow(new IllegalStateException("db error")).when(dsrLoanRepository).deleteByMemberId(MEMBER_ID);

        // When, Then
        assertThatThrownBy(() -> memberService.withdraw(MEMBER_ID)).isInstanceOf(IllegalStateException.class);
        assertThat(member.getMemberStatus()).isEqualTo(1);
        assertThat(member.getSocialId()).isEqualTo("kakao-123");
    }

    // ---------- 회원 정보 수정: 닉네임 ----------

    @Test
    @DisplayName("닉네임이 2자이면 바뀐다")
    void updateNicknameTwoChars() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update("가나", null, null));

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("가나");
    }

    @Test
    @DisplayName("닉네임이 12자이면 바뀐다")
    void updateNicknameTwelveChars() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update("가나다라마바사아자차카타", null, null));

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("가나다라마바사아자차카타");
    }

    @Test
    @DisplayName("닉네임이 1자이면 400 (INVALID_INPUT)")
    void updateNicknameOneChar() {
        // Given
        givenMember(activeMember());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update("가", null, null)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("닉네임이 13자이면 400 (INVALID_INPUT)")
    void updateNicknameThirteenChars() {
        // Given
        givenMember(activeMember());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update("가나다라마바사아자차카타파", null, null)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("닉네임이 공백뿐이면 400")
    void updateNicknameOnlySpaces() {
        // Given
        givenMember(activeMember());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update("      ", null, null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("닉네임이 빈 글이면 400")
    void updateNicknameEmpty() {
        // Given
        givenMember(activeMember());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update("", null, null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("닉네임의 앞뒤 공백은 제거되어 저장된다")
    void updateNicknameTrimmed() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update("  가나다  ", null, null));

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("가나다");
    }

    @Test
    @DisplayName("앞뒤 공백을 빼면 12자인 닉네임은 통과하고 공백 없이 저장된다")
    void updateNicknameTwelveCharsWithOuterSpaces() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update("  가나다라마바사아자차카타  ", null, null));

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("가나다라마바사아자차카타");
    }

    @Test
    @DisplayName("닉네임 글 중간의 공백은 그대로 남는다 (제거하지 않음)")
    void updateNicknameInnerSpaceKept() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update("가 나", null, null));

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("가 나");
    }

    @Test
    @DisplayName("닉네임을 안 보내면 기존 닉네임이 그대로이다")
    void updateWithoutNicknameKeepsNickname() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update(null, "2000", "05-15"));

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("캐링");
    }

    @Test
    @DisplayName("닉네임이 틀리면 같이 보낸 생년월일도 바뀌지 않는다")
    void updateInvalidNicknameKeepsBirth() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update("가", "2000", "05-15")))
                .isInstanceOf(BusinessException.class);

        // Then
        assertThat(member.getBirthYear()).isEqualTo("1990");
        assertThat(member.getBirthDay()).isEqualTo("01-01");
    }

    // ---------- 회원 정보 수정: 생년월일 ----------

    @Test
    @DisplayName("생년월일을 보내면 출생연도와 생일이 바뀐다")
    void updateBirth() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update(null, "2000", "05-15"));

        // Then
        assertThat(member.getBirthYear()).isEqualTo("2000");
        assertThat(member.getBirthDay()).isEqualTo("05-15");
    }

    @Test
    @DisplayName("생년월일을 안 보내면 기존 생년월일이 그대로이다")
    void updateWithoutBirthKeepsBirth() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update("새닉네임", null, null));

        // Then
        assertThat(member.getBirthYear()).isEqualTo("1990");
        assertThat(member.getBirthDay()).isEqualTo("01-01");
    }

    @Test
    @DisplayName("출생연도만 보내면 400")
    void updateOnlyBirthYear() {
        // Given
        givenMember(activeMember());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update(null, "2000", null)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("생일만 보내면 400")
    void updateOnlyBirthDay() {
        // Given
        givenMember(activeMember());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update(null, null, "05-15")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("내년 생년월일(미래 날짜)이면 400")
    void updateFutureBirth() {
        // Given
        givenMember(activeMember());
        String nextYear = String.valueOf(LocalDate.now().getYear() + 1);

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update(null, nextYear, "01-01")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("오늘 태어난 것으로 바꾸면 미성년자라 400이다")
    void updateTodayBirthIsMinor() {
        // Given
        Member member = activeMember();
        givenMember(member);
        LocalDate today = LocalDate.now();
        String year = String.valueOf(today.getYear());
        String day = String.format("%02d-%02d", today.getMonthValue(), today.getDayOfMonth());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update(null, year, day)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
        assertThat(member.getBirthYear()).isEqualTo("1990");
    }

    @Test
    @DisplayName("만 19세 생일 당일이면 바뀐다")
    void updateBirthOnNineteenthBirthday() {
        // Given
        Member member = activeMember();
        givenMember(member);
        LocalDate birth = LocalDate.now().minusYears(19);
        String year = String.valueOf(birth.getYear());
        String day = String.format("%02d-%02d", birth.getMonthValue(), birth.getDayOfMonth());

        // When
        memberService.updateMember(MEMBER_ID, update(null, year, day));

        // Then
        assertThat(member.getBirthYear()).isEqualTo(year);
        assertThat(member.getBirthDay()).isEqualTo(day);
    }

    @Test
    @DisplayName("만 19세 생일 하루 전이면 미성년자라 400이고 바뀌지 않는다")
    void updateBirthOneDayBeforeNineteenthBirthday() {
        // Given
        Member member = activeMember();
        givenMember(member);
        LocalDate birth = LocalDate.now().minusYears(19).plusDays(1);
        String year = String.valueOf(birth.getYear());
        String day = String.format("%02d-%02d", birth.getMonthValue(), birth.getDayOfMonth());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update(null, year, day)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
        assertThat(member.getBirthYear()).isEqualTo("1990");
        assertThat(member.getBirthDay()).isEqualTo("01-01");
    }

    @Test
    @DisplayName("10살이 되는 생년월일이면 400이다")
    void updateBirthTenYearsOld() {
        // Given
        givenMember(activeMember());
        LocalDate birth = LocalDate.now().minusYears(10);
        String year = String.valueOf(birth.getYear());
        String day = String.format("%02d-%02d", birth.getMonthValue(), birth.getDayOfMonth());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update(null, year, day)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("미성년자 생년월일이면 같이 보낸 닉네임도 바뀌지 않는다")
    void updateMinorBirthKeepsNickname() {
        // Given
        Member member = activeMember();
        givenMember(member);
        LocalDate birth = LocalDate.now().minusYears(15);
        String year = String.valueOf(birth.getYear());
        String day = String.format("%02d-%02d", birth.getMonthValue(), birth.getDayOfMonth());

        // When
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update("새닉네임", year, day)))
                .isInstanceOf(BusinessException.class);

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("캐링");
    }

    @Test
    @DisplayName("1899년이면 400 (1900년 이전)")
    void updateBirthBefore1900() {
        // Given
        givenMember(activeMember());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update(null, "1899", "12-31")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("1900년 1월 1일은 통과한다")
    void updateBirth1900() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update(null, "1900", "01-01"));

        // Then
        assertThat(member.getBirthYear()).isEqualTo("1900");
    }

    @Test
    @DisplayName("없는 날짜(2월 30일)이면 400")
    void updateNonexistentDate() {
        // Given
        givenMember(activeMember());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update(null, "2000", "02-30")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("윤년이 아닌 해의 2월 29일이면 400")
    void updateLeapDayInNonLeapYear() {
        // Given
        givenMember(activeMember());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update(null, "2001", "02-29")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("윤년의 2월 29일은 통과한다")
    void updateLeapDayInLeapYear() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update(null, "2000", "02-29"));

        // Then
        assertThat(member.getBirthDay()).isEqualTo("02-29");
    }

    @Test
    @DisplayName("생년월일이 틀리면 같이 보낸 닉네임도 바뀌지 않는다")
    void updateInvalidBirthKeepsNickname() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update("새닉네임", "1899", "01-01")))
                .isInstanceOf(BusinessException.class);

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("캐링");
    }

    // ---------- 회원 정보 수정: 그 밖 ----------

    @Test
    @DisplayName("닉네임과 생년월일을 함께 바꿀 수 있다")
    void updateBoth() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update("새닉네임", "2000", "05-15"));

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("새닉네임");
        assertThat(member.getBirthYear()).isEqualTo("2000");
        assertThat(member.getBirthDay()).isEqualTo("05-15");
    }

    @Test
    @DisplayName("아무 값도 안 보내면 모든 값이 그대로이다")
    void updateNothing() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update(null, null, null));

        // Then
        assertThat(member.getMemberNickname()).isEqualTo("캐링");
        assertThat(member.getBirthYear()).isEqualTo("1990");
        assertThat(member.getBirthDay()).isEqualTo("01-01");
    }

    @Test
    @DisplayName("응답에는 바뀐 닉네임, 출생연도, 생일과 로그인 방법이 담긴다")
    void updateResponse() {
        // Given
        givenMember(activeMember());

        // When
        MemberResponseDTO result = memberService.updateMember(MEMBER_ID, update("새닉네임", "2000", "05-15"));

        // Then
        assertThat(result.getMemberNickname()).isEqualTo("새닉네임");
        assertThat(result.getBirthYear()).isEqualTo("2000");
        assertThat(result.getBirthDay()).isEqualTo("05-15");
        assertThat(result.getLoginType()).isEqualTo("KAKAO");
    }

    @Test
    @DisplayName("수정해도 로그인 방법과 소셜 식별값, 상태는 바뀌지 않는다")
    void updateKeepsOtherFields() {
        // Given
        Member member = activeMember();
        givenMember(member);

        // When
        memberService.updateMember(MEMBER_ID, update("새닉네임", "2000", "05-15"));

        // Then
        assertThat(member.getLoginType()).isEqualTo("KAKAO");
        assertThat(member.getSocialId()).isEqualTo("kakao-123");
        assertThat(member.getMemberStatus()).isEqualTo(1);
    }

    @Test
    @DisplayName("회원이 없으면 404 (NOT_FOUND)")
    void updateMemberNotFound() {
        // Given
        when(memberRepository.findById(MEMBER_ID)).thenReturn(Optional.empty());

        // When, Then
        assertThatThrownBy(() -> memberService.updateMember(MEMBER_ID, update("새닉네임", null, null)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    @DisplayName("수정은 인자로 받은 회원 번호의 회원만 조회한다 (B3)")
    void updateUsesOnlyGivenMemberId() {
        // Given
        givenMember(activeMember());

        // When
        memberService.updateMember(MEMBER_ID, update("새닉네임", null, null));

        // Then
        verify(memberRepository).findById(MEMBER_ID);
        verify(memberRepository, never()).findById(OTHER_MEMBER_ID);
    }

    // ---------- 도우미 ----------

    // 닉네임, 출생연도, 생일을 담은 수정 요청 (값이 없으면 null)
    private MemberUpdateRequestDTO update(String nickname, String birthYear, String birthDay) {
        MemberUpdateRequestDTO dto = new MemberUpdateRequestDTO();
        dto.setMemberNickname(nickname);
        dto.setBirthYear(birthYear);
        dto.setBirthDay(birthDay);
        return dto;
    }

    // 정상 회원 (member_status 1, 소셜 식별값 있음)
    private Member activeMember() {
        return Member.builder().memberId(MEMBER_ID).loginType("KAKAO").socialId("kakao-123")
                .memberNickname("캐링").birthYear("1990").birthDay("01-01").memberStatus(1)
                .createdAt(LocalDateTime.of(2026, 11, 1, 10, 0, 0)).build();
    }

    // 회원 조회가 이 회원을 돌려주는 상태
    private void givenMember(Member member) {
        when(memberRepository.findById(MEMBER_ID)).thenReturn(Optional.of(member));
    }

    // 세 리포지토리가 회원의 개수를 돌려주는 상태
    private void givenCounts(long wish, long recentView, long compare, long calc,
                             long dsr, long change, long homeLimit, long reverse) {
        when(wishRepository.countByMemberId(MEMBER_ID)).thenReturn(wish);
        when(recentViewRepository.countByMemberId(MEMBER_ID)).thenReturn(recentView);
        when(compareHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(compare);
        when(calcHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(calc);
        when(dsrCalcHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(dsr);
        when(changeCalcHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(change);
        when(homeLimitCalcHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(homeLimit);
        when(reverseCalcHistoryRepository.countByMemberId(MEMBER_ID)).thenReturn(reverse);
    }
}
