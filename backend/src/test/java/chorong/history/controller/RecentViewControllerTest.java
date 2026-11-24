package chorong.history.controller;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
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
import chorong.history.dto.RecentViewResponseDTO;
import chorong.history.service.RecentViewService;

/*
 * RecentViewController 테스트 (MEM-08 권한 B3: 회원 번호는 세션에서만, 입력 검사 B2)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 * 기대값 출처: be_member.md MEM-08 (주소 /api/me/recent-views, 응답 items, POST/DELETE 204, POST 본문 productId, 한 건 DELETE는 주소)
 */
class RecentViewControllerTest {

    private static final Long MEMBER_ID = 1L;
    private static final String URL = "/api/me/recent-views";

    private RecentViewService recentViewService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        recentViewService = mock(RecentViewService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new RecentViewController(recentViewService))
                .addMappedInterceptors(new String[] { "/api/me/**" }, new LoginInterceptor())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private static MockHttpSession memberSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(MEMBER_ID, "회원", "1990", "01-01"));
        return session;
    }

    // ---------- 비회원 (401) ----------

    @Test
    @DisplayName("비회원이 최근 본 목록을 보면 401")
    void getWithoutLogin() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 기록하면 401")
    void postWithoutLogin() throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content("{\"productId\": 10}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 한 건 삭제하면 401")
    void deleteOneWithoutLogin() throws Exception {
        mockMvc.perform(delete(URL + "/10")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 전체 삭제하면 401")
    void deleteAllWithoutLogin() throws Exception {
        mockMvc.perform(delete(URL)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이면 서비스를 부르지 않는다")
    void withoutLoginDoesNotCallService() throws Exception {
        // When
        mockMvc.perform(delete(URL));

        // Then
        verify(recentViewService, never()).deleteRecentViews(org.mockito.ArgumentMatchers.anyLong());
    }

    // ---------- 목록 GET ----------

    @Test
    @DisplayName("회원이 최근 본 목록을 보면 200")
    void getOk() throws Exception {
        mockMvc.perform(get(URL).session(memberSession())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("응답 data는 items 키 아래에 목록을 담는다")
    void getResponseHasItems() throws Exception {
        // Given
        when(recentViewService.getRecentViews(MEMBER_ID))
                .thenReturn(List.of(new RecentViewResponseDTO(null, LocalDateTime.of(2026, 11, 20, 12, 0, 0))));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession()))
                .andExpect(jsonPath("$.data.items.length()").value(1));
    }

    @Test
    @DisplayName("기록이 없으면 items는 빈 목록이다")
    void getEmptyItems() throws Exception {
        // Given
        when(recentViewService.getRecentViews(MEMBER_ID)).thenReturn(List.of());

        // When, Then
        mockMvc.perform(get(URL).session(memberSession()))
                .andExpect(jsonPath("$.data.items.length()").value(0));
    }

    @Test
    @DisplayName("목록은 세션의 회원 번호로 조회한다")
    void getUsesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(get(URL).param("memberId", "99").session(memberSession()));

        // Then
        verify(recentViewService).getRecentViews(MEMBER_ID);
    }

    // ---------- 기록 POST ----------

    @Test
    @DisplayName("회원이 본문 {productId}로 기록하면 204")
    void postNoContent() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productId\": 10}"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("기록은 세션의 회원 번호와 본문의 상품 번호를 서비스에 넘긴다")
    void postPassesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(post(URL).session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content("{\"productId\": 10}"));

        // Then
        verify(recentViewService).saveRecentView(MEMBER_ID, 10L);
    }

    @Test
    @DisplayName("요청에 다른 회원 번호를 실어도 세션의 회원 번호만 쓴다 (B3)")
    void postIgnoresMemberIdInRequest() throws Exception {
        // When
        mockMvc.perform(post(URL).param("memberId", "99").session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content("{\"productId\": 10}"));

        // Then
        verify(recentViewService).saveRecentView(MEMBER_ID, 10L);
    }

    @Test
    @DisplayName("본문에 productId가 없으면 400")
    void postWithoutProductId() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("productId가 null이면 400")
    void postNullProductId() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productId\": null}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("productId가 숫자가 아니면 400")
    void postNonNumericProductId() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productId\": \"abc\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("본문이 없으면 400")
    void postWithoutBody() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("입력 오류이면 서비스를 부르지 않는다")
    void postInvalidDoesNotCallService() throws Exception {
        // When
        mockMvc.perform(post(URL).session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content("{}"));

        // Then
        verify(recentViewService, never()).saveRecentView(org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    @DisplayName("없는 상품이면 404")
    void postProductNotFound() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(recentViewService).saveRecentView(MEMBER_ID, 10L);

        // When, Then
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productId\": 10}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("동시 요청으로 unique가 막혀 CONFLICT이면 409")
    void postConflict() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.CONFLICT)).when(recentViewService).saveRecentView(MEMBER_ID, 10L);

        // When, Then
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productId\": 10}"))
                .andExpect(status().isConflict());
    }

    // ---------- 한 건 삭제 DELETE /{productId} ----------

    @Test
    @DisplayName("회원이 한 건 삭제하면 204")
    void deleteOneNoContent() throws Exception {
        mockMvc.perform(delete(URL + "/10").session(memberSession())).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("한 건 삭제는 세션의 회원 번호와 주소의 상품 번호를 서비스에 넘긴다")
    void deleteOnePassesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(delete(URL + "/10").session(memberSession()));

        // Then
        verify(recentViewService).deleteRecentView(MEMBER_ID, 10L);
    }

    @Test
    @DisplayName("한 건 삭제도 요청에 실린 다른 회원 번호는 무시한다 (B3)")
    void deleteOneIgnoresMemberIdInRequest() throws Exception {
        // When
        mockMvc.perform(delete(URL + "/10").param("memberId", "99").session(memberSession()));

        // Then
        verify(recentViewService).deleteRecentView(MEMBER_ID, 10L);
    }

    @Test
    @DisplayName("내 기록이 아니거나 없는 기록이면 404")
    void deleteOneNotFound() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(recentViewService).deleteRecentView(MEMBER_ID, 10L);

        // When, Then
        mockMvc.perform(delete(URL + "/10").session(memberSession())).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("상품 번호가 숫자가 아니면 400")
    void deleteOneInvalidProductId() throws Exception {
        mockMvc.perform(delete(URL + "/abc").session(memberSession())).andExpect(status().isBadRequest());
    }

    // ---------- 전체 삭제 DELETE ----------

    @Test
    @DisplayName("회원이 전체 삭제하면 204")
    void deleteAllNoContent() throws Exception {
        mockMvc.perform(delete(URL).session(memberSession())).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("전체 삭제는 세션의 회원 번호로 서비스를 부른다")
    void deleteAllUsesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(delete(URL).param("memberId", "99").session(memberSession()));

        // Then
        verify(recentViewService).deleteRecentViews(MEMBER_ID);
    }
}
