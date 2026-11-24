package chorong.history.controller;

import chorong.common.dto.ApiResponse;
import chorong.common.util.LoginUtil;
import chorong.history.dto.SearchHistoryRequestDTO;
import chorong.history.dto.SearchHistoryResponseDTO;
import chorong.history.service.SearchHistoryService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

/*
 * 최근 검색 (MEM-09, API-22): GET /api/me/searches, POST /api/me/searches, DELETE /api/me/searches/{searchId}
 * 권한: 회원 (로그인 확인은 LoginInterceptor, 회원 번호는 세션에서만 꺼냄, B3)
 */

@RestController
@RequestMapping("/api/me/searches")
@RequiredArgsConstructor
public class SearchHistoryController {
    private final SearchHistoryService searchHistoryService;
    // GET /api/me/searches (최근 검색 10개, 응답 data는 items)
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<SearchHistoryResponseDTO>>>> getSearchHistories(HttpSession session) {
        List<SearchHistoryResponseDTO> items = searchHistoryService.getSearchHistories(LoginUtil.getMemberId(session));

        return ResponseEntity.ok(ApiResponse.success(Map.of("items", items)));
    }

    // POST /api/me/searches (본문: type, label, condition, 응답 204)
    @PostMapping
    public ResponseEntity<Void> saveSearchHistory(HttpSession session, @RequestBody @Valid SearchHistoryRequestDTO dto) {
        searchHistoryService.saveSearchHistory(LoginUtil.getMemberId(session), dto);

        return ResponseEntity.noContent().build();
    }

    // DELETE /api/me/searches/{searchId} (내 기록 중 그 1건, 응답 204, 없거나 남의 기록은 404)
    @DeleteMapping("/{searchId}")
    public ResponseEntity<Void> deleteSearchHistory( HttpSession session,@PathVariable Long searchId) {
        searchHistoryService.deleteSearchHistory(LoginUtil.getMemberId(session), searchId);
        return ResponseEntity.noContent().build();
    }

    // DELETE /api/me/searches ({searchId} 없음: 내 기록 전체, 응답 204)
    @DeleteMapping
    public ResponseEntity<Void> deleteSearchHistories(HttpSession session) {
        searchHistoryService.deleteSearchHistories(LoginUtil.getMemberId(session));
        return ResponseEntity.noContent().build();
    }
}
