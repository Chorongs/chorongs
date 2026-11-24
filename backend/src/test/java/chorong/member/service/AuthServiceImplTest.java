package chorong.member.service;

import chorong.admin.entity.AdminRole;
import chorong.common.dto.LoginAdminDTO;
import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.SessionConst;
import chorong.member.dto.MemberResponseDTO;
import chorong.member.dto.SignupRequestDTO;
import chorong.member.dto.SocialUserDTO;
import chorong.member.entity.Member;
import chorong.member.repository.MemberRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpSession;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;



@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private MemberRepository memberRepository;

    @InjectMocks
    private AuthServiceImpl authService;

    // ---------- MEM-03 내 정보 (B3) ----------

    @Test
    @DisplayName("로그인하지 않고 내 정보를 보면 LOGIN_REQUIRED(401)")
    void getMeWithoutLogin() {
        // Given
        MockHttpSession session = new MockHttpSession();

        // When, Then
        assertThatThrownBy(() -> authService.getMe(session))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.LOGIN_REQUIRED));
    }

    @Test
    @DisplayName("세션이 아예 없어도 내 정보는 LOGIN_REQUIRED(401)")
    void getMeWithoutSession() {
        // Given, When, Then
        assertThatThrownBy(() -> authService.getMe(null))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.LOGIN_REQUIRED));
    }

    @Test
    @DisplayName("탈퇴한 회원의 세션으로 내 정보를 보면 401")
    void getMeWithdrawnMember() {
        // Given
        MockHttpSession session = loginSession(1L);
        when(memberRepository.findById(1L)).thenReturn(Optional.of(member(1L, 0)));

        // When, Then
        assertThatThrownBy(() -> authService.getMe(session))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.LOGIN_REQUIRED));
    }

    @Test
    @DisplayName("탈퇴한 회원의 세션은 내 정보를 볼 때 끊어진다")
    void getMeWithdrawnMemberClearsSession() {
        // Given
        MockHttpSession session = loginSession(1L);
        when(memberRepository.findById(1L)).thenReturn(Optional.of(member(1L, 0)));

        // When
        assertThatThrownBy(() -> authService.getMe(session)).isInstanceOf(BusinessException.class);

        // Then
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isNull();
    }

    @Test
    @DisplayName("로그인한 회원은 자기 정보를 받는다")
    void getMeSuccess() {
        // Given
        MockHttpSession session = loginSession(1L);
        when(memberRepository.findById(1L)).thenReturn(Optional.of(member(1L, 1)));

        // When
        MemberResponseDTO response = authService.getMe(session);

        // Then
        assertThat(response.getMemberNickname()).isEqualTo("재영");
    }

    // ---------- MEM-02 로그아웃 ----------

    @Test
    @DisplayName("로그아웃하면 세션의 회원 로그인 정보가 지워진다")
    void logoutRemovesLoginMember() {
        // Given
        MockHttpSession session = loginSession(1L);

        // When
        authService.logout(session);

        // Then
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isNull();
    }

    @Test
    @DisplayName("세션이 없어도 로그아웃은 오류 없이 끝난다")
    void logoutWithoutSession() {
        // Given, When, Then
        authService.logout(null);
    }

    // ---------- MEM-01 로그인, 가입 대기 ----------

    @Test
    @DisplayName("가입한 회원이 소셜 로그인하면 세션에 로그인 정보가 저장된다")
    void loginExistingMember() {
        // Given
        MockHttpSession session = new MockHttpSession();
        when(memberRepository.findByLoginTypeAndSocialId("KAKAO", "social-1"))
                .thenReturn(Optional.of(member(7L, 1)));

        // When
        boolean loggedIn = authService.login(session, social());

        // Then
        assertThat(((LoginMemberDTO) session.getAttribute(SessionConst.LOGIN_MEMBER)).getMemberId()).isEqualTo(7L);
        assertThat(loggedIn).isTrue();
    }

    @Test
    @DisplayName("가입하지 않은 소셜 계정은 로그인되지 않는다")
    void loginNewMember() {
        // Given
        MockHttpSession session = new MockHttpSession();
        when(memberRepository.findByLoginTypeAndSocialId("KAKAO", "social-1")).thenReturn(Optional.empty());

        // When
        boolean loggedIn = authService.login(session, social());

        // Then
        assertThat(loggedIn).isFalse();
    }

    // ---------- MEM-12 가입 완료 ----------

    @Test
    @DisplayName("가입 대기가 없으면 SIGNUP_EXPIRED(400)")
    void signupWithoutPending() {
        // Given
        MockHttpSession session = new MockHttpSession();

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, "1998", "05-15")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.SIGNUP_EXPIRED));
    }

    @Test
    @DisplayName("가입 대기가 10분 지났으면 SIGNUP_EXPIRED(400)")
    void signupPendingExpired() {
        // Given
        MockHttpSession session = new MockHttpSession();
        SocialUserDTO social = social();
        social.setPendingAt(LocalDateTime.now().minusMinutes(11));
        session.setAttribute(SessionConst.PENDING_SIGNUP, social);

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, "1998", "05-15")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.SIGNUP_EXPIRED));
    }

    @Test
    @DisplayName("관리자로 로그인 중이면 가입할 수 없다 (ADMIN_LOGGED_IN)")
    void signupWhileAdminLoggedIn() {
        // Given
        MockHttpSession session = pendingSession(social());
        session.setAttribute(SessionConst.LOGIN_ADMIN,
                new LoginAdminDTO(1L, "관리자", AdminRole.MANAGER, LocalDateTime.now()));

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, "1998", "05-15")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.ADMIN_LOGGED_IN));
    }

    @Test
    @DisplayName("약관에 동의하지 않으면 가입할 수 없다")
    void signupTermsNotAgreed() {
        // Given
        MockHttpSession session = pendingSession(social());

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(false, "1998", "05-15")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("생년월일을 입력해야 하는데 안 보내면 400")
    void signupBirthMissing() {
        // Given
        MockHttpSession session = pendingSession(social());

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, null, null)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("미래 생년월일이면 400")
    void signupBirthFuture() {
        // Given
        MockHttpSession session = pendingSession(social());
        String nextYear = String.valueOf(LocalDateTime.now().getYear() + 1);

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, nextYear, "01-01")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("1900년 이전 생년월일이면 400")
    void signupBirthBefore1900() {
        // Given
        MockHttpSession session = pendingSession(social());

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, "1899", "12-31")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("없는 날짜(평년 2월 29일)면 400")
    void signupBirthNotExistingDate() {
        // Given
        MockHttpSession session = pendingSession(social());

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, "1999", "02-29")))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("정상 가입하면 member가 저장된다")
    void signupSavesMember() {
        // Given
        MockHttpSession session = pendingSession(social());
        when(memberRepository.findByLoginTypeAndSocialId("KAKAO", "social-1")).thenReturn(Optional.empty());
        when(memberRepository.save(any(Member.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // When
        authService.signup(session, new SignupRequestDTO(true, "1998", "05-15"));

        // Then
        verify(memberRepository).save(any(Member.class));
    }

    @Test
    @DisplayName("정상 가입하면 가입 대기가 지워지고 로그인 정보가 저장된다")
    void signupLogsIn() {
        // Given
        MockHttpSession session = pendingSession(social());
        when(memberRepository.findByLoginTypeAndSocialId("KAKAO", "social-1")).thenReturn(Optional.empty());
        when(memberRepository.save(any(Member.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // When
        authService.signup(session, new SignupRequestDTO(true, "1998", "05-15"));

        // Then
        assertThat(session.getAttribute(SessionConst.PENDING_SIGNUP)).isNull();
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isNotNull();
    }

    @Test
    @DisplayName("네이버가 생년월일을 보냈으면 요청 값 대신 네이버 값으로 가입한다")
    void signupUsesNaverBirth() {
        // Given
        SocialUserDTO naver = new SocialUserDTO("NAVER", "naver-1", "재영", "1990", "03-04", null);
        MockHttpSession session = pendingSession(naver);
        when(memberRepository.findByLoginTypeAndSocialId("NAVER", "naver-1")).thenReturn(Optional.empty());
        when(memberRepository.save(any(Member.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // When
        MemberResponseDTO response = authService.signup(session, new SignupRequestDTO(true, null, null));

        // Then
        assertThat(response.getBirthYear()).isEqualTo("1990");
    }

    @Test
    @DisplayName("이미 같은 소셜 계정의 회원이 있으면 새로 만들지 않는다")
    void signupExistingMemberNotDuplicated() {
        // Given
        MockHttpSession session = pendingSession(social());
        when(memberRepository.findByLoginTypeAndSocialId("KAKAO", "social-1"))
                .thenReturn(Optional.of(member(7L, 1)));

        // When
        authService.signup(session, new SignupRequestDTO(true, "1998", "05-15"));

        // Then
        verify(memberRepository, never()).save(any(Member.class));
    }

    // ---------- 만 19세 미만 가입 불가 (명세서에 없는 규칙, 사용자 결정: 400 INVALID_INPUT, 막히면 가입 대기 삭제) ----------

    @Test
    @DisplayName("만 19세 생일 당일에는 가입할 수 있다")
    void signupOnNineteenthBirthday() {
        // Given
        MockHttpSession session = pendingSession(social());
        LocalDate birth = LocalDate.now().minusYears(19);
        when(memberRepository.findByLoginTypeAndSocialId("KAKAO", "social-1")).thenReturn(Optional.empty());
        when(memberRepository.save(any(Member.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // When
        authService.signup(session, new SignupRequestDTO(true, year(birth), monthDay(birth)));

        // Then
        verify(memberRepository).save(any(Member.class));
    }

    @Test
    @DisplayName("만 19세 생일 하루 전이면 INVALID_INPUT(400)")
    void signupOneDayBeforeNineteenthBirthday() {
        // Given
        MockHttpSession session = pendingSession(social());
        LocalDate birth = LocalDate.now().minusYears(19).plusDays(1);

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, year(birth), monthDay(birth))))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("미성년(만 10세)이면 INVALID_INPUT(400)")
    void signupMinor() {
        // Given
        MockHttpSession session = pendingSession(social());
        LocalDate birth = LocalDate.now().minusYears(10);

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, year(birth), monthDay(birth))))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("미성년이면 member를 저장하지 않는다")
    void signupMinorNotSaved() {
        // Given
        MockHttpSession session = pendingSession(social());
        LocalDate birth = LocalDate.now().minusYears(10);

        // When
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, year(birth), monthDay(birth))))
                .isInstanceOf(BusinessException.class);

        // Then
        verify(memberRepository, never()).save(any(Member.class));
    }

    @Test
    @DisplayName("미성년이라 막히면 가입 대기가 지워진다")
    void signupMinorClearsPending() {
        // Given
        MockHttpSession session = pendingSession(social());
        LocalDate birth = LocalDate.now().minusYears(10);

        // When
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, year(birth), monthDay(birth))))
                .isInstanceOf(BusinessException.class);

        // Then
        assertThat(session.getAttribute(SessionConst.PENDING_SIGNUP)).isNull();
    }

    @Test
    @DisplayName("미성년이라 막혀도 로그인 정보는 저장되지 않는다")
    void signupMinorNotLoggedIn() {
        // Given
        MockHttpSession session = pendingSession(social());
        LocalDate birth = LocalDate.now().minusYears(10);

        // When
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, year(birth), monthDay(birth))))
                .isInstanceOf(BusinessException.class);

        // Then
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isNull();
    }

    @Test
    @DisplayName("네이버가 준 생년월일이 미성년이면 INVALID_INPUT(400)")
    void signupNaverMinor() {
        // Given
        LocalDate birth = LocalDate.now().minusYears(15);
        SocialUserDTO naver = new SocialUserDTO("NAVER", "naver-1", "재영", year(birth), monthDay(birth), null);
        MockHttpSession session = pendingSession(naver);

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, null, null)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("네이버가 준 생년월일이 없는 날짜(02-30)면 INVALID_INPUT(400)")
    void signupNaverNotExistingDate() {
        // Given
        SocialUserDTO naver = new SocialUserDTO("NAVER", "naver-1", "재영", "1990", "02-30", null);
        MockHttpSession session = pendingSession(naver);

        // When, Then
        assertThatThrownBy(() -> authService.signup(session, new SignupRequestDTO(true, null, null)))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }

    // ---------- 도우미 ----------

    private String year(LocalDate date) {
        return String.valueOf(date.getYear());
    }

    private String monthDay(LocalDate date) {
        return String.format("%02d-%02d", date.getMonthValue(), date.getDayOfMonth());
    }

    private SocialUserDTO social() {
        return new SocialUserDTO("KAKAO", "social-1", "재영", null, null, null);
    }

    private MockHttpSession pendingSession(SocialUserDTO social) {
        MockHttpSession session = new MockHttpSession();
        social.setPendingAt(LocalDateTime.now());
        session.setAttribute(SessionConst.PENDING_SIGNUP, social);
        return session;
    }

    private MockHttpSession loginSession(Long memberId) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(memberId, "재영", "1998", "05-15"));
        return session;
    }

    private Member member(Long memberId, int status) {
        return Member.builder()
                .memberId(memberId)
                .loginType("KAKAO")
                .socialId("social-1")
                .memberNickname("재영")
                .birthYear("1998")
                .birthDay("05-15")
                .memberStatus(status)
                .termsAgreedAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();
    }
}
