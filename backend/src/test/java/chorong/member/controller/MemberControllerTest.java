package chorong.member.controller;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.interceptor.LoginInterceptor;
import chorong.common.util.SessionConst;
import chorong.member.dto.MySummaryResponseDTO;
import chorong.member.service.MemberService;

/*
 * MemberController 테스트 (MEM-13 MY 요약 권한 B3: 회원 번호는 세션에서만)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 * 기대값 출처: be_member.md MEM-13, fe_member.md API-51
 *   GET /api/me/summary, 응답 data에 wishCount, recentViewCount, compareCount, calcCount, 비회원 401
 */
class MemberControllerTest {

    private static final Long MEMBER_ID = 1L;
    private static final String URL = "/api/me/summary";

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
        when(memberService.getMySummary(MEMBER_ID)).thenReturn(new MySummaryResponseDTO(3L, 4L, 5L, 0L));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("응답은 ApiResponse의 data 안에 개수 4개를 담는다")
    void getResponseFields() throws Exception {
        // Given
        when(memberService.getMySummary(MEMBER_ID)).thenReturn(new MySummaryResponseDTO(3L, 4L, 5L, 0L));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession()))
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.wishCount").value(3))
                .andExpect(jsonPath("$.data.recentViewCount").value(4))
                .andExpect(jsonPath("$.data.compareCount").value(5))
                .andExpect(jsonPath("$.data.calcCount").value(0));
    }

    @Test
    @DisplayName("요약은 세션의 회원 번호로 조회한다")
    void getUsesSessionMemberId() throws Exception {
        // Given
        when(memberService.getMySummary(MEMBER_ID)).thenReturn(new MySummaryResponseDTO(0L, 0L, 0L, 0L));

        // When
        mockMvc.perform(get(URL).session(memberSession()));

        // Then
        verify(memberService).getMySummary(MEMBER_ID);
    }

    @Test
    @DisplayName("요청에 다른 회원 번호를 실어도 세션의 회원 번호만 쓴다 (B3)")
    void getIgnoresMemberIdInRequest() throws Exception {
        // Given
        when(memberService.getMySummary(MEMBER_ID)).thenReturn(new MySummaryResponseDTO(0L, 0L, 0L, 0L));

        // When
        mockMvc.perform(get(URL).param("memberId", "99").session(memberSession()));

        // Then
        verify(memberService).getMySummary(MEMBER_ID);
        verify(memberService, never()).getMySummary(99L);
    }
}
