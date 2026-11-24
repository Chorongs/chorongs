package chorong.history.controller;

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
import chorong.history.dto.SearchHistoryRequestDTO;
import chorong.history.dto.SearchHistoryResponseDTO;
import chorong.history.service.SearchHistoryService;

/*
 * SearchHistoryController 테스트 (MEM-09 권한 B3: 회원 번호는 세션에서만, 입력 검사 B2, B8)
 * 실제 설정(WebConfig)처럼 /api/me/**에 LoginInterceptor를 붙여 요청을 보냄
 * 기대값 출처: be_member.md MEM-09, fe_member.md, fe_search.md
 *   주소 /api/me/searches, GET 응답 items (searchId, searchType, searchLabel, searchCondition, searchedAt),
 *   POST 본문 type(FILTER, SIMPLE만), label(200자), condition / POST, DELETE 204, 한 건 DELETE는 주소의 searchId
 * 명세서에 없는 선택(사용자 결정): condition은 길이를 제한하지 않는다
 * 날짜 글자 형식(searchedAt)은 명세서에 없어 확인하지 않는다
 */
class SearchHistoryControllerTest {

    private static final Long MEMBER_ID = 1L;
    private static final String URL = "/api/me/searches";
    private static final String VALID_CONDITION = "{\"job\":\"근로자\"}";

    private SearchHistoryService searchHistoryService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        searchHistoryService = mock(SearchHistoryService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new SearchHistoryController(searchHistoryService))
                .addMappedInterceptors(new String[] { "/api/me/**" }, new LoginInterceptor())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private static MockHttpSession memberSession() {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(MEMBER_ID, "회원", "1990", "01-01"));
        return session;
    }

    // 요청 본문 JSON (명세서의 요청 값 이름: type, label, condition). null이면 JSON null
    private static String body(String type, String label, String condition) {
        return "{\"type\":" + quote(type) + ",\"label\":" + quote(label) + ",\"condition\":" + quote(condition) + "}";
    }

    private static String quote(String value) {
        if (value == null) {
            return "null";
        }
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String validBody() {
        return body("FILTER", "근로자 · 생활비", VALID_CONDITION);
    }

    // ---------- 비회원 (401) ----------

    @Test
    @DisplayName("비회원이 최근 검색 목록을 보면 401")
    void getWithoutLogin() throws Exception {
        mockMvc.perform(get(URL)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 기록하면 401")
    void postWithoutLogin() throws Exception {
        mockMvc.perform(post(URL).contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("비회원이 한 건 삭제하면 401")
    void deleteOneWithoutLogin() throws Exception {
        mockMvc.perform(delete(URL + "/100")).andExpect(status().isUnauthorized());
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
        verify(searchHistoryService, never()).deleteSearchHistories(anyLong());
    }

    // ---------- 목록 GET ----------

    @Test
    @DisplayName("회원이 최근 검색 목록을 보면 200")
    void getOk() throws Exception {
        mockMvc.perform(get(URL).session(memberSession())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("응답 data는 items 키 아래에 목록을 담는다")
    void getResponseHasItems() throws Exception {
        // Given
        when(searchHistoryService.getSearchHistories(MEMBER_ID)).thenReturn(List.of(
                new SearchHistoryResponseDTO(100L, "FILTER", "근로자 · 생활비", VALID_CONDITION,
                        LocalDateTime.of(2026, 11, 20, 12, 0, 0))));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession()))
                .andExpect(jsonPath("$.data.items.length()").value(1));
    }

    @Test
    @DisplayName("items의 한 줄에 searchId, searchType, searchLabel, searchCondition, searchedAt이 있다")
    void getItemFields() throws Exception {
        // Given
        when(searchHistoryService.getSearchHistories(MEMBER_ID)).thenReturn(List.of(
                new SearchHistoryResponseDTO(100L, "SIMPLE", "대출 상품 검색", VALID_CONDITION,
                        LocalDateTime.of(2026, 11, 20, 12, 0, 0))));

        // When, Then
        mockMvc.perform(get(URL).session(memberSession()))
                .andExpect(jsonPath("$.data.items[0].searchId").value(100))
                .andExpect(jsonPath("$.data.items[0].searchType").value("SIMPLE"))
                .andExpect(jsonPath("$.data.items[0].searchLabel").value("대출 상품 검색"))
                .andExpect(jsonPath("$.data.items[0].searchCondition").value(VALID_CONDITION))
                .andExpect(jsonPath("$.data.items[0].searchedAt").exists());
    }

    @Test
    @DisplayName("기록이 없으면 items는 빈 목록이다")
    void getEmptyItems() throws Exception {
        // Given
        when(searchHistoryService.getSearchHistories(MEMBER_ID)).thenReturn(List.of());

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
        verify(searchHistoryService).getSearchHistories(MEMBER_ID);
    }

    // ---------- 기록 POST ----------

    @Test
    @DisplayName("회원이 본문 {type, label, condition}으로 기록하면 204")
    void postNoContent() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("기록은 세션의 회원 번호를 서비스에 넘긴다")
    void postPassesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(post(URL).session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content(validBody()));

        // Then
        verify(searchHistoryService).saveSearchHistory(eq(MEMBER_ID), any(SearchHistoryRequestDTO.class));
    }

    @Test
    @DisplayName("요청에 다른 회원 번호를 실어도 세션의 회원 번호만 쓴다 (B3)")
    void postIgnoresMemberIdInRequest() throws Exception {
        // When
        mockMvc.perform(post(URL).param("memberId", "99").session(memberSession())
                .contentType(MediaType.APPLICATION_JSON).content(validBody()));

        // Then
        verify(searchHistoryService).saveSearchHistory(eq(MEMBER_ID), any(SearchHistoryRequestDTO.class));
    }

    @Test
    @DisplayName("type이 FILTER이면 204")
    void postTypeFilter() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(body("FILTER", "라벨", VALID_CONDITION)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("type이 SIMPLE이면 204")
    void postTypeSimple() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(body("SIMPLE", "라벨", VALID_CONDITION)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("type이 RECOMMEND이면 400 (B8)")
    void postTypeRecommend() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(body("RECOMMEND", "라벨", VALID_CONDITION)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("type이 소문자(filter)이면 400")
    void postTypeLowerCase() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(body("filter", "라벨", VALID_CONDITION)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("type이 허용 값에 다른 글을 붙인 값(FILTERX)이면 400")
    void postTypeExtraText() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(body("FILTERX", "라벨", VALID_CONDITION)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("type이 비어 있으면 400")
    void postTypeBlank() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(body("", "라벨", VALID_CONDITION)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("type이 없으면 400")
    void postWithoutType() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"label\":\"라벨\",\"condition\":\"{}\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("label이 비어 있으면 400")
    void postLabelBlank() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(body("FILTER", "  ", VALID_CONDITION)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("label이 없으면 400")
    void postWithoutLabel() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"FILTER\",\"condition\":\"{}\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("label이 200자이면 204")
    void postLabel200() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("FILTER", "가".repeat(200), VALID_CONDITION)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("label이 201자이면 400 (DB 오류로 가기 전에 막는다)")
    void postLabel201() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("FILTER", "가".repeat(201), VALID_CONDITION)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("condition이 비어 있으면 400")
    void postConditionBlank() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(body("FILTER", "라벨", " ")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("condition이 없으면 400")
    void postWithoutCondition() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"FILTER\",\"label\":\"라벨\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("condition은 길이를 제한하지 않는다 (사용자 결정)")
    void postLongCondition() throws Exception {
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("FILTER", "라벨", "가".repeat(20000))))
                .andExpect(status().isNoContent());
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
                .contentType(MediaType.APPLICATION_JSON).content(body("RECOMMEND", "라벨", VALID_CONDITION)));

        // Then
        verify(searchHistoryService, never()).saveSearchHistory(anyLong(), any(SearchHistoryRequestDTO.class));
    }

    @Test
    @DisplayName("동시 요청으로 unique가 막혀 CONFLICT이면 409")
    void postConflict() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.CONFLICT)).when(searchHistoryService)
                .saveSearchHistory(eq(MEMBER_ID), any(SearchHistoryRequestDTO.class));

        // When, Then
        mockMvc.perform(post(URL).session(memberSession())
                        .contentType(MediaType.APPLICATION_JSON).content(validBody()))
                .andExpect(status().isConflict());
    }

    // ---------- 한 건 삭제 DELETE /{searchId} ----------

    @Test
    @DisplayName("회원이 한 건 삭제하면 204")
    void deleteOneNoContent() throws Exception {
        mockMvc.perform(delete(URL + "/100").session(memberSession())).andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("한 건 삭제는 세션의 회원 번호와 주소의 기록 번호를 서비스에 넘긴다")
    void deleteOnePassesSessionMemberId() throws Exception {
        // When
        mockMvc.perform(delete(URL + "/100").session(memberSession()));

        // Then
        verify(searchHistoryService).deleteSearchHistory(MEMBER_ID, 100L);
    }

    @Test
    @DisplayName("한 건 삭제도 요청에 실린 다른 회원 번호는 무시한다 (B3)")
    void deleteOneIgnoresMemberIdInRequest() throws Exception {
        // When
        mockMvc.perform(delete(URL + "/100").param("memberId", "99").session(memberSession()));

        // Then
        verify(searchHistoryService).deleteSearchHistory(MEMBER_ID, 100L);
    }

    @Test
    @DisplayName("내 기록이 아니거나 없는 기록이면 404")
    void deleteOneNotFound() throws Exception {
        // Given
        doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(searchHistoryService)
                .deleteSearchHistory(MEMBER_ID, 100L);

        // When, Then
        mockMvc.perform(delete(URL + "/100").session(memberSession())).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("기록 번호가 숫자가 아니면 400")
    void deleteOneInvalidSearchId() throws Exception {
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
        verify(searchHistoryService).deleteSearchHistories(MEMBER_ID);
    }
}
