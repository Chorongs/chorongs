package chorong.history.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.List;

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
import chorong.history.dto.CompareHistoryRequestDTO;
import chorong.history.dto.CompareHistoryResponseDTO;
import chorong.history.service.CompareHistoryService;
import chorong.product.dto.ProductSummaryDTO;

/*
 * CompareHistoryController 테스트 (MEM-10 권한 B3: 회원 번호는 세션에서만, 입력 검사 B2)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 * 기대값 출처: be_member.md MEM-10, fe_member.md, fe_compare.md
 *   주소 /api/me/compares, GET 응답 items (compareId, comparedAt, productA, productB),
 *   POST 본문 productAId, productBId → 201 (같은 상품 400, 없는 상품 404, 같은 조합 409), DELETE 204 (한 건은 주소의 compareId)
 */
class CompareHistoryControllerTest {

    private static final Long MEMBER_ID = 1L;
    private static final String URL = "/api/me/compares";
    private static final String VALID_BODY = "{\"productAId\": 10, \"productBId\": 30}";

    private CompareHistoryService compareHistoryService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        compareHistoryService = mock(CompareHistoryService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new CompareHistoryController(compareHistoryService))
                .addMappedInterceptors(new String[] { "/api/me/**" }, new LoginInterceptor())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private static MockHttpSession memberSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(MEMBER_ID, "회원", "1990", "01-01"));
        return session;
    }

    private static ProductSummaryDTO summary(Long productId) {
        ProductSummaryDTO dto = new ProductSummaryDTO();
        dto.setProductId(productId);
        return dto;
    }

    // ---------- 비회원 (401) ----------

    @Test
    @DisplayName("비회원이 비교 내역 목록을 보면 401")
    void getWithoutLogin() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 기록하면 401")
    void postWithoutLogin() throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 한 건 삭제하면 401")
    void deleteOneWithoutLogin() throws Exception {
        mockMvc.perform(delete(URL + "/500")).andExpect(status().isUnauthorized());
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
        verify(compareHistoryService, never()).deleteCompareHistories(anyLong());
    }

    // ---------- 목록 GET ----------

    @Test
    @DisplayName("회원이 비교 내역 목록을 보면 200")
    void getOk() throws Exception {
        mockMvc.perform(get(URL).session(memberSession())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("응답 data는 items 키 아래에 목록을 담는다")
    void getResponseHasItems() throws Exception {
        // Given
        when(compareHistoryService.getCompareHistories(MEMBER_ID)).thenReturn(List.of(
                new CompareHistoryResponseDTO(500L, LocalDateTime.of(2026, 11, 20, 12, 0, 0), summary(10L), summary(30L))));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession()))
                .andExpect(jsonPath("$.data.items.length()").value(1));
    }

    @Test
    @DisplayName("items의 한 줄에 compareId, comparedAt, productA, productB가 있다")
    void getItemFields() throws Exception {
        // Given
        when(compareHistoryService.getCompareHistories(MEMBER_ID)).thenReturn(List.of(
                new CompareHistoryResponseDTO(500L, LocalDateTime.of(2026, 11, 20, 12, 0, 0), summary(10L), summary(30L))));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession()))
                .andExpect(jsonPath("$.data.items[0].compareId").value(500))
                .andExpect(jsonPath("$.data.items[0].comparedAt").exists())
                .andExpect(jsonPath("$.data.items[0].productA.productId").value(10))
                .andExpect(jsonPath("$.data.items[0].productB.productId").value(30));
    }

    @Test
    @DisplayName("기록이 없으면 items는 빈 목록이다")
    void getEmptyItems() throws Exception {
        // Given
        when(compareHistoryService.getCompareHistories(MEMBER_ID)).thenReturn(List.of());

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
        verify(compareHistoryService).getCompareHistories(MEMBER_ID);
    }

    // ---------- 기록 POST ----------

    @Test
    @DisplayName("회원이 본문 {productAId, productBId}로 기록하면 201")
    void postCreated() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("기록은 세션의 회원 번호를 서비스에 넘긴다")
    void postPassesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(post(URL).session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY));

        // Then
        verify(compareHistoryService).saveCompareHistory(eq(MEMBER_ID), any(CompareHistoryRequestDTO.class));
    }

    @Test
    @DisplayName("본문의 두 상품 번호가 서비스에 그대로 넘어간다")
    void postPassesProductIds() throws Exception {
        // When
        mockMvc.perform(post(URL).session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY));

        // Then
        ArgumentCaptor<CompareHistoryRequestDTO> captor = ArgumentCaptor.forClass(CompareHistoryRequestDTO.class);
        verify(compareHistoryService).saveCompareHistory(eq(MEMBER_ID), captor.capture());
        assertThat(captor.getValue().getProductAId()).isEqualTo(10L);
        assertThat(captor.getValue().getProductBId()).isEqualTo(30L);
    }

    @Test
    @DisplayName("요청에 다른 회원 번호를 실어도 세션의 회원 번호만 쓴다 (B3)")
    void postIgnoresMemberIdInRequest() throws Exception {
        // When
        mockMvc.perform(post(URL).param("memberId", "99").session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content(
                        "{\"memberId\": 99, \"productAId\": 10, \"productBId\": 30}"));

        // Then
        verify(compareHistoryService).saveCompareHistory(eq(MEMBER_ID), any(CompareHistoryRequestDTO.class));
    }

    @Test
    @DisplayName("productAId가 없으면 400")
    void postWithoutProductAId() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productBId\": 30}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("productBId가 없으면 400")
    void postWithoutProductBId() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productAId\": 10}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("productAId가 null이면 400")
    void postNullProductAId() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productAId\": null, \"productBId\": 30}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("상품 번호가 숫자가 아니면 400")
    void postNonNumericProductId() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productAId\": \"abc\", \"productBId\": 30}"))
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
                .contentType(MediaType.APPLICATION_JSON).content("{\"productAId\": 10}"));

        // Then
        verify(compareHistoryService, never()).saveCompareHistory(anyLong(), any(CompareHistoryRequestDTO.class));
    }

    @Test
    @DisplayName("A와 B가 같은 상품이면 400")
    void postSameProduct() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.INVALID_INPUT)).when(compareHistoryService)
                .saveCompareHistory(eq(MEMBER_ID), any(CompareHistoryRequestDTO.class));

        // When, Then
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"productAId\": 10, \"productBId\": 10}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("없는 상품이면 404")
    void postProductNotFound() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(compareHistoryService)
                .saveCompareHistory(eq(MEMBER_ID), any(CompareHistoryRequestDTO.class));

        // When, Then
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("이미 저장한 조합이면 409와 CONFLICT 코드, '이미 저장한 조합' 문구")
    void postConflict() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.CONFLICT, "이미 저장한 조합입니다.")).when(compareHistoryService)
                .saveCompareHistory(eq(MEMBER_ID), any(CompareHistoryRequestDTO.class));

        // When, Then
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value(containsString("이미 저장한 조합")));
    }

    // ---------- 한 건 삭제 DELETE /{compareId} ----------

    @Test
    @DisplayName("회원이 한 건 삭제하면 204")
    void deleteOneNoContent() throws Exception {
        mockMvc.perform(delete(URL + "/500").session(memberSession())).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("한 건 삭제는 세션의 회원 번호와 주소의 기록 번호를 서비스에 넘긴다")
    void deleteOnePassesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(delete(URL + "/500").session(memberSession()));

        // Then
        verify(compareHistoryService).deleteCompareHistory(MEMBER_ID, 500L);
    }

    @Test
    @DisplayName("한 건 삭제도 요청에 실린 다른 회원 번호는 무시한다 (B3)")
    void deleteOneIgnoresMemberIdInRequest() throws Exception {
        // When
        mockMvc.perform(delete(URL + "/500").param("memberId", "99").session(memberSession()));

        // Then
        verify(compareHistoryService).deleteCompareHistory(MEMBER_ID, 500L);
    }

    @Test
    @DisplayName("내 기록이 아니거나 없는 기록이면 404")
    void deleteOneNotFound() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(compareHistoryService)
                .deleteCompareHistory(MEMBER_ID, 500L);

        // When, Then
        mockMvc.perform(delete(URL + "/500").session(memberSession())).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("기록 번호가 숫자가 아니면 400")
    void deleteOneInvalidCompareId() throws Exception {
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
        verify(compareHistoryService).deleteCompareHistories(MEMBER_ID);
    }
}
