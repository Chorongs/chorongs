package chorong.wish.controller;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
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

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import chorong.common.dto.LoginMemberDTO;
import chorong.common.dto.PageInfo;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.exception.GlobalExceptionHandler;
import chorong.common.interceptor.LoginInterceptor;
import chorong.common.util.SessionConst;
import chorong.wish.dto.WishResponseDTO;
import chorong.wish.service.WishService;

/*
 * WishController 테스트 (MEM-04 권한 B3: 회원 번호는 세션에서만)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 * 기대값 출처: be_member.md MEM-04 (주소 /api/me/likes, 응답 PageInfo, 409 ALREADY_LIKED / LIKE_FULL),
 *            be_common.md (200 성공 / 201 새로 만듦 / 204 내용 없음)
 */
class WishControllerTest {

    private static final Long MEMBER_ID = 1L;
    private static final String URL = "/api/me/likes";

    private WishService wishService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        wishService = mock(WishService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new WishController(wishService))
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
    @DisplayName("비회원이 찜하면 401")
    void postWithoutLogin() throws Exception {
        mockMvc.perform(post(URL + "/10")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 찜을 취소하면 401")
    void deleteWithoutLogin() throws Exception {
        mockMvc.perform(delete(URL + "/10")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 찜 목록을 보면 401")
    void getWithoutLogin() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이면 서비스를 부르지 않는다")
    void withoutLoginDoesNotCallService() throws Exception {
        // When
        mockMvc.perform(delete(URL + "/10"));

        // Then
        verify(wishService, never()).deleteWish(anyLong(), anyLong());
    }

    // ---------- 찜하기 POST ----------

    @Test
    @DisplayName("회원이 찜하면 201")
    void postCreated() throws Exception {
        mockMvc.perform(post(URL + "/10").session(memberSession())).andExpect(status().isCreated());
    }

    @Test
    @DisplayName("찜하기는 세션의 회원 번호와 주소의 상품 번호를 서비스에 넘긴다")
    void postPassesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(post(URL + "/10").session(memberSession()));

        // Then
        verify(wishService).saveWish(MEMBER_ID, 10L);
    }

    @Test
    @DisplayName("요청에 다른 회원 번호를 실어도 세션의 회원 번호만 쓴다 (B3)")
    void postIgnoresMemberIdInRequest() throws Exception {
        // When
        mockMvc.perform(post(URL + "/10").param("memberId", "99").session(memberSession()));

        // Then
        verify(wishService).saveWish(MEMBER_ID, 10L);
    }

    @Test
    @DisplayName("이미 찜한 상품이면 409 ALREADY_LIKED")
    void postAlreadyLiked() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.ALREADY_LIKED)).when(wishService).saveWish(MEMBER_ID, 10L);

        // When, Then
        mockMvc.perform(post(URL + "/10").session(memberSession()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ALREADY_LIKED"));
    }

    @Test
    @DisplayName("찜이 가득 차면 409 LIKE_FULL")
    void postLikeFull() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.LIKE_FULL)).when(wishService).saveWish(MEMBER_ID, 10L);

        // When, Then
        mockMvc.perform(post(URL + "/10").session(memberSession()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LIKE_FULL"));
    }

    @Test
    @DisplayName("없는 상품이면 404")
    void postProductNotFound() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(wishService).saveWish(MEMBER_ID, 10L);

        // When, Then
        mockMvc.perform(post(URL + "/10").session(memberSession())).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("상품 번호가 숫자가 아니면 400")
    void postInvalidProductId() throws Exception {
        mockMvc.perform(post(URL + "/abc").session(memberSession())).andExpect(status().isBadRequest());
    }

    // ---------- 찜 취소 DELETE ----------

    @Test
    @DisplayName("회원이 찜을 취소하면 204")
    void deleteNoContent() throws Exception {
        mockMvc.perform(delete(URL + "/10").session(memberSession())).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("찜 취소는 세션의 회원 번호와 주소의 상품 번호를 서비스에 넘긴다")
    void deletePassesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(delete(URL + "/10").session(memberSession()));

        // Then
        verify(wishService).deleteWish(MEMBER_ID, 10L);
    }

    @Test
    @DisplayName("찜 취소도 요청에 실린 다른 회원 번호는 무시한다 (B3)")
    void deleteIgnoresMemberIdInRequest() throws Exception {
        // When
        mockMvc.perform(delete(URL + "/10").param("memberId", "99").session(memberSession()));

        // Then
        verify(wishService).deleteWish(MEMBER_ID, 10L);
    }

    @Test
    @DisplayName("내 찜이 아니거나 없는 찜이면 404")
    void deleteNotFound() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(wishService).deleteWish(MEMBER_ID, 10L);

        // When, Then
        mockMvc.perform(delete(URL + "/10").session(memberSession())).andExpect(status().isNotFound());
    }

    // ---------- 찜 목록 GET ----------

    @Test
    @DisplayName("찜 목록은 /api/me/likes (끝 슬래시 없음)로 200")
    void getOk() throws Exception {
        // Given
        when(wishService.getWishes(eq(MEMBER_ID), anyInt(), anyInt()))
                .thenReturn(new PageInfo<WishResponseDTO>(List.of(), 0L, 1, 20));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("page, size를 주지 않으면 1쪽, 20개로 서비스를 부른다")
    void getDefaults() throws Exception {
        // Given
        when(wishService.getWishes(eq(MEMBER_ID), anyInt(), anyInt()))
                .thenReturn(new PageInfo<WishResponseDTO>(List.of(), 0L, 1, 20));

        // When
        mockMvc.perform(get(URL).session(memberSession()));

        // Then
        verify(wishService).getWishes(MEMBER_ID, 1, 20);
    }

    @Test
    @DisplayName("요청한 page, size를 그대로 서비스에 넘긴다")
    void getPassesPageAndSize() throws Exception {
        // Given
        when(wishService.getWishes(eq(MEMBER_ID), anyInt(), anyInt()))
                .thenReturn(new PageInfo<WishResponseDTO>(List.of(), 0L, 2, 10));

        // When
        mockMvc.perform(get(URL).param("page", "2").param("size", "10").session(memberSession()));

        // Then
        verify(wishService).getWishes(MEMBER_ID, 2, 10);
    }

    @Test
    @DisplayName("응답 data에 PageInfo의 total이 담긴다")
    void getResponseHasTotal() throws Exception {
        // Given
        when(wishService.getWishes(eq(MEMBER_ID), anyInt(), anyInt()))
                .thenReturn(new PageInfo<WishResponseDTO>(List.of(), 25L, 1, 20));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession()))
                .andExpect(jsonPath("$.data.total").value(25));
    }

    @Test
    @DisplayName("page가 숫자가 아니면 400")
    void getInvalidPage() throws Exception {
        mockMvc.perform(get(URL).param("page", "abc").session(memberSession())).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("서비스가 INVALID_INPUT을 던지면 400")
    void getInvalidInput() throws Exception {
        // Given
        when(wishService.getWishes(MEMBER_ID, 0, 20)).thenThrow(new BusinessException(ErrorCode.INVALID_INPUT));

        // When, Then
        mockMvc.perform(get(URL).param("page", "0").session(memberSession())).andExpect(status().isBadRequest());
    }
}
