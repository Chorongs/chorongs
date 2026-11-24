package chorong.member.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.interceptor.LoginInterceptor;
import chorong.common.util.SessionConst;
import chorong.member.dto.MemberResponseDTO;
import chorong.member.dto.MemberUpdateRequestDTO;
import chorong.member.dto.MySummaryResponseDTO;
import chorong.member.service.MemberService;

/*
 * MemberController 테스트 (MEM-13 MY 요약, MEM-07 회원 탈퇴, 권한 B3: 회원 번호는 세션에서만)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 * 기대값 출처: be_member.md MEM-13, MEM-07, fe_member.md API-51
 *   MY 요약: GET /api/me/summary, 응답 data에 개수, 비회원 401
 *   탈퇴: DELETE /api/me, 응답 204, 서비스가 성공한 뒤 세션에서 회원 로그인 정보 삭제
 *   회원 정보 수정 (MEM-11): PATCH /api/me, 본문 nickname, birthYear, birthDay (바꿀 것만), 응답 MemberResponseDTO,
 *         형식 오류 400 (B2), 세션 회원 번호로만 (B3), 성공 뒤 세션의 로그인 정보를 새 값으로 갱신 (사용자 결정)
 * 명세서와 다른 곳(사용자 결정, 계산 기록 기능을 없앨 예정이라는 이야기가 있어 명세서 수정 전):
 *   MY 요약 응답에 calcCount가 없음 (개수 3개)
 */
class MemberControllerTest {

    private static final Long MEMBER_ID = 1L;
    private static final String URL = "/api/me/summary";
    private static final String WITHDRAW_URL = "/api/me";

    private MemberService memberService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        memberService = mock(MemberService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new MemberController(memberService))
                .addMappedInterceptors(new String[] { "/api/me/**" }, new LoginInterceptor())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private static MockHttpSession memberSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(MEMBER_ID, "회원", "1990", "01-01"));
        return session;
    }

    // 수정 성공 응답 (서비스가 돌려주는 값)
    private static MemberResponseDTO updated() {
        return new MemberResponseDTO("새닉네임", "KAKAO", "2000", "05-15");
    }

    // ---------- MY 요약 ----------

    @Test
    @DisplayName("비회원이 MY 요약을 보면 401")
    void getWithoutLogin() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이면 서비스를 부르지 않는다")
    void withoutLoginDoesNotCallService() throws Exception {
        // When
        mockMvc.perform(get(URL));

        // Then
        verify(memberService, never()).getMySummary(anyLong());
    }

    @Test
    @DisplayName("회원이 MY 요약을 보면 200")
    void getOk() throws Exception {
        // Given
        when(memberService.getMySummary(MEMBER_ID)).thenReturn(new MySummaryResponseDTO(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("응답은 ApiResponse의 data 안에 개수를 담는다")
    void getResponseFields() throws Exception {
        // Given
        when(memberService.getMySummary(MEMBER_ID)).thenReturn(new MySummaryResponseDTO(3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession()))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.wishCount").value(3))
                .andExpect(jsonPath("$.data.recentViewCount").value(4))
                .andExpect(jsonPath("$.data.compareCount").value(5))
                .andExpect(jsonPath("$.data.calcCount").value(6))
                .andExpect(jsonPath("$.data.dsrCount").value(7))
                .andExpect(jsonPath("$.data.changeCount").value(8))
                .andExpect(jsonPath("$.data.homeLimitCount").value(9))
                .andExpect(jsonPath("$.data.reversCalcCount").value(10));
    }

    @Test
    @DisplayName("요약은 세션의 회원 번호로 조회한다")
    void getUsesSessionMemberId() throws Exception {
        // Given
        when(memberService.getMySummary(MEMBER_ID)).thenReturn(new MySummaryResponseDTO(0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L));

        // When
        mockMvc.perform(get(URL).session(memberSession()));

        // Then
        verify(memberService).getMySummary(MEMBER_ID);
    }

    @Test
    @DisplayName("요청에 다른 회원 번호를 실어도 세션의 회원 번호만 쓴다 (B3)")
    void getIgnoresMemberIdInRequest() throws Exception {
        // Given
        when(memberService.getMySummary(MEMBER_ID)).thenReturn(new MySummaryResponseDTO(0L, 0L, 0L, 0L, 0L, 0L, 0L, 0L));

        // When
        mockMvc.perform(get(URL).param("memberId", "99").session(memberSession()));

        // Then
        verify(memberService).getMySummary(MEMBER_ID);
        verify(memberService, never()).getMySummary(99L);
    }

    // ---------- 회원 탈퇴 DELETE /api/me ----------

    @Test
    @DisplayName("비회원이 탈퇴하면 401")
    void withdrawWithoutLogin() throws Exception {
        mockMvc.perform(delete(WITHDRAW_URL)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 탈퇴하면 서비스를 부르지 않는다")
    void withdrawWithoutLoginDoesNotCallService() throws Exception {
        // When
        mockMvc.perform(delete(WITHDRAW_URL));

        // Then
        verify(memberService, never()).withdraw(anyLong());
    }

    @Test
    @DisplayName("회원이 탈퇴하면 204")
    void withdrawNoContent() throws Exception {
        mockMvc.perform(delete(WITHDRAW_URL).session(memberSession())).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("탈퇴는 세션의 회원 번호로 서비스를 부른다")
    void withdrawUsesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(delete(WITHDRAW_URL).session(memberSession()));

        // Then
        verify(memberService).withdraw(MEMBER_ID);
    }

    @Test
    @DisplayName("요청에 다른 회원 번호를 실어도 세션의 회원 번호만 쓴다 (B3)")
    void withdrawIgnoresMemberIdInRequest() throws Exception {
        // When
        mockMvc.perform(delete(WITHDRAW_URL).param("memberId", "99").session(memberSession()));

        // Then
        verify(memberService).withdraw(MEMBER_ID);
        verify(memberService, never()).withdraw(99L);
    }

    @Test
    @DisplayName("탈퇴가 성공하면 세션에서 회원 로그인 정보가 삭제된다")
    void withdrawRemovesLoginFromSession() throws Exception {
        // Given
        MockHttpSession session = memberSession();

        // When
        mockMvc.perform(delete(WITHDRAW_URL).session(session));

        // Then
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isNull();
    }

    @Test
    @DisplayName("회원이 없어 404이면 세션의 로그인 정보는 그대로 남는다")
    void withdrawNotFoundKeepsSession() throws Exception {
        // Given
        MockHttpSession session = memberSession();
        doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(memberService).withdraw(MEMBER_ID);

        // When
        mockMvc.perform(delete(WITHDRAW_URL).session(session)).andExpect(status().isNotFound());

        // Then
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isNotNull();
    }

    // ---------- 회원 정보 수정 PATCH /api/me ----------

    @Test
    @DisplayName("비회원이 수정하면 401")
    void patchWithoutLogin() throws Exception {
        mockMvc.perform(patch(WITHDRAW_URL).contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"새닉네임\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 수정하면 서비스를 부르지 않는다")
    void patchWithoutLoginDoesNotCallService() throws Exception {
        // When
        mockMvc.perform(patch(WITHDRAW_URL).contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"새닉네임\"}"));

        // Then
        verify(memberService, never()).updateMember(anyLong(), any(MemberUpdateRequestDTO.class));
    }

    @Test
    @DisplayName("회원이 수정하면 200과 ApiResponse의 data에 수정된 내 정보를 담는다")
    void patchOk() throws Exception {
        // Given
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class))).thenReturn(updated());

        // When, Then
        mockMvc.perform(patch(WITHDRAW_URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"새닉네임\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.memberNickname").value("새닉네임"))
                .andExpect(jsonPath("$.data.loginType").value("KAKAO"))
                .andExpect(jsonPath("$.data.birthYear").value("2000"))
                .andExpect(jsonPath("$.data.birthDay").value("05-15"));
    }

    @Test
    @DisplayName("본문의 nickname, birthYear, birthDay가 서비스에 넘어간다")
    void patchPassesBody() throws Exception {
        // Given
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class))).thenReturn(updated());

        // When
        mockMvc.perform(patch(WITHDRAW_URL).session(memberSession()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"새닉네임\",\"birthYear\":\"2000\",\"birthDay\":\"05-15\"}"));

        // Then
        ArgumentCaptor<MemberUpdateRequestDTO> captor = ArgumentCaptor.forClass(MemberUpdateRequestDTO.class);
        verify(memberService).updateMember(eq(MEMBER_ID), captor.capture());
        assertThat(captor.getValue().getMemberNickname()).isEqualTo("새닉네임");
        assertThat(captor.getValue().getBirthYear()).isEqualTo("2000");
        assertThat(captor.getValue().getBirthDay()).isEqualTo("05-15");
    }

    @Test
    @DisplayName("바꿀 것만 보내도(닉네임만) 200")
    void patchOnlyNickname() throws Exception {
        // Given
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class))).thenReturn(updated());

        // When, Then
        mockMvc.perform(patch(WITHDRAW_URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"새닉네임\"}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("바꿀 것만 보내도(생년월일만) 200")
    void patchOnlyBirth() throws Exception {
        // Given
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class))).thenReturn(updated());

        // When, Then
        mockMvc.perform(patch(WITHDRAW_URL).session(memberSession()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"birthYear\":\"2000\",\"birthDay\":\"05-15\"}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("수정은 세션의 회원 번호로 서비스를 부른다")
    void patchUsesSessionMemberId() throws Exception {
        // Given
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class))).thenReturn(updated());

        // When
        mockMvc.perform(patch(WITHDRAW_URL).session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"새닉네임\"}"));

        // Then
        verify(memberService).updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class));
    }

    @Test
    @DisplayName("요청에 다른 회원 번호를 실어도 세션의 회원 번호만 쓴다 (B3)")
    void patchIgnoresMemberIdInRequest() throws Exception {
        // Given
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class))).thenReturn(updated());

        // When
        mockMvc.perform(patch(WITHDRAW_URL).param("memberId", "99").session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content("{\"memberId\":99,\"nickname\":\"새닉네임\"}"));

        // Then
        verify(memberService).updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class));
        verify(memberService, never()).updateMember(eq(99L), any(MemberUpdateRequestDTO.class));
    }

    @Test
    @DisplayName("수정이 성공하면 세션의 로그인 정보가 새 닉네임과 생년월일로 갱신된다")
    void patchUpdatesSession() throws Exception {
        // Given
        MockHttpSession session = memberSession();
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class))).thenReturn(updated());

        // When
        mockMvc.perform(patch(WITHDRAW_URL).session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"새닉네임\"}"));

        // Then
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER))
                .isEqualTo(new LoginMemberDTO(MEMBER_ID, "새닉네임", "2000", "05-15"));
    }

    @Test
    @DisplayName("수정 뒤에도 세션에서 회원 번호를 꺼낼 수 있다 (세션 값이 LoginMemberDTO 타입)")
    void patchKeepsSessionUsable() throws Exception {
        // Given
        MockHttpSession session = memberSession();
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class))).thenReturn(updated());
        mockMvc.perform(patch(WITHDRAW_URL).session(session)
                .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"새닉네임\"}"));

        // When: 같은 세션으로 이어서 요청
        mockMvc.perform(delete(WITHDRAW_URL).session(session)).andExpect(status().isNoContent());

        // Then
        verify(memberService).withdraw(MEMBER_ID);
    }

    @Test
    @DisplayName("본문이 비어 있어도({}) 서비스를 부르고 200")
    void patchEmptyObject() throws Exception {
        // Given
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class))).thenReturn(updated());

        // When, Then
        mockMvc.perform(patch(WITHDRAW_URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("출생연도 형식이 틀리면 400")
    void patchInvalidBirthYearFormat() throws Exception {
        mockMvc.perform(patch(WITHDRAW_URL).session(memberSession()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"birthYear\":\"98\",\"birthDay\":\"05-15\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("생일 형식이 틀리면 400")
    void patchInvalidBirthDayFormat() throws Exception {
        mockMvc.perform(patch(WITHDRAW_URL).session(memberSession()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"birthYear\":\"1998\",\"birthDay\":\"13-40\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("입력 형식 오류이면 서비스를 부르지 않고 세션도 그대로 둔다")
    void patchInvalidDoesNotCallServiceOrChangeSession() throws Exception {
        // Given
        MockHttpSession session = memberSession();
        Object before = session.getAttribute(SessionConst.LOGIN_MEMBER);

        // When
        mockMvc.perform(patch(WITHDRAW_URL).session(session).contentType(MediaType.APPLICATION_JSON)
                .content("{\"birthYear\":\"98\",\"birthDay\":\"05-15\"}"));

        // Then
        verify(memberService, never()).updateMember(anyLong(), any(MemberUpdateRequestDTO.class));
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isEqualTo(before);
    }

    @Test
    @DisplayName("본문이 없으면 400")
    void patchWithoutBody() throws Exception {
        mockMvc.perform(patch(WITHDRAW_URL).session(memberSession())).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("서비스가 400(INVALID_INPUT)을 던지면 400이고 세션은 그대로이다")
    void patchServiceInvalidKeepsSession() throws Exception {
        // Given
        MockHttpSession session = memberSession();
        Object before = session.getAttribute(SessionConst.LOGIN_MEMBER);
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class)))
                .thenThrow(new BusinessException(ErrorCode.INVALID_INPUT));

        // When
        mockMvc.perform(patch(WITHDRAW_URL).session(session)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"가\"}"))
                .andExpect(status().isBadRequest());

        // Then
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isEqualTo(before);
    }

    @Test
    @DisplayName("회원이 없어 404이면 세션은 그대로이다")
    void patchNotFoundKeepsSession() throws Exception {
        // Given
        MockHttpSession session = memberSession();
        Object before = session.getAttribute(SessionConst.LOGIN_MEMBER);
        when(memberService.updateMember(eq(MEMBER_ID), any(MemberUpdateRequestDTO.class)))
                .thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

        // When
        mockMvc.perform(patch(WITHDRAW_URL).session(session)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"nickname\":\"새닉네임\"}"))
                .andExpect(status().isNotFound());

        // Then
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isEqualTo(before);
    }

    @Test
    @DisplayName("서비스가 실패하면 세션의 로그인 정보는 그대로 남는다")
    void withdrawFailureKeepsSession() throws Exception {
        // Given
        MockHttpSession session = memberSession();
        doThrow(new BusinessException(ErrorCode.SERVER_ERROR)).when(memberService).withdraw(MEMBER_ID);

        // When
        mockMvc.perform(delete(WITHDRAW_URL).session(session));

        // Then
        assertThat(session.getAttribute(SessionConst.LOGIN_MEMBER)).isNotNull();
    }
}
