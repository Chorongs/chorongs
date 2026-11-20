package chorong.history.controller;

import chorong.common.dto.ApiResponse;
import chorong.common.util.LoginUtil;
import chorong.history.dto.RecentViewRequestDTO;
import chorong.history.dto.RecentViewResponseDTO;
import chorong.history.service.RecentViewService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

/*
 * 최근 본 대출 (MEM-08, API-21): GET /api/me/recent-views, POST /api/me/recent-views, DELETE /api/me/recent-views/{productId}
 * 권한: 회원 (로그인 확인은 LoginInterceptor, 회원 번호는 세션에서만 꺼냄, B3)
 */
@RestController
@RequestMapping("/api/me/recent-views")
@RequiredArgsConstructor
public class RecentViewController {
    private final RecentViewService recentViewService;
    // GET /api/me/recent-views (최근 본 10개)
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<RecentViewResponseDTO>>>> getRecentViews(HttpSession session) {
        List<RecentViewResponseDTO> items = recentViewService.getRecentViews(LoginUtil.getMemberId(session)); // 세션 회원의 최근 본 목록
        return ResponseEntity.ok(ApiResponse.success(Map.of("items", items)));                                // "items" 키로 감싸서 200
    }

    // POST /api/me/recent-views (본문: productId, 응답 204)
    @PostMapping
    public ResponseEntity<Void> saveRecentView(HttpSession session, @RequestBody @Valid RecentViewRequestDTO dto) {
        recentViewService.saveRecentView(LoginUtil.getMemberId(session), dto.getProductId());
        return ResponseEntity.noContent().build();
    }

    // DELETE /api/me/recent-views/{productId} (내 기록 중 그 상품 1건, 응답 204)
    @DeleteMapping("/{productId}")
    public ResponseEntity<Void> deleteRecentView(HttpSession session, @PathVariable("productId") Long productId) {
        recentViewService.deleteRecentView(LoginUtil.getMemberId(session), productId);

        return ResponseEntity.noContent().build();
    }

    // DELETE /api/me/recent-views ({productId} 없음: 내 기록 전체, 응답 204)
    @DeleteMapping
    public ResponseEntity<Void> deleteRecentViews(HttpSession session) {
        recentViewService.deleteRecentViews(LoginUtil.getMemberId(session));

        return ResponseEntity.noContent().build();
    }
}
