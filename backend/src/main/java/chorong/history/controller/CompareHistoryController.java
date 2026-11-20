package chorong.history.controller;

import chorong.common.dto.ApiResponse;
import chorong.common.util.LoginUtil;
import chorong.history.dto.CompareHistoryRequestDTO;
import chorong.history.dto.CompareHistoryResponseDTO;
import chorong.history.service.CompareHistoryService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/*
 * 비교 내역 (MEM-10, API-23): GET /api/me/compares, POST /api/me/compares, DELETE /api/me/compares/{compareId}
 * 권한: 회원 (로그인 확인은 LoginInterceptor, 회원 번호는 세션에서만 꺼냄, B3)
 */
@RestController
@RequestMapping("/api/me/compares")
@RequiredArgsConstructor
public class CompareHistoryController {
    private final CompareHistoryService compareHistoryService;
    // GET /api/me/compares (최근 비교 10개, 응답 data는 items)
    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<CompareHistoryResponseDTO>>>> getCompareHistories(HttpSession session) {
        List<CompareHistoryResponseDTO> items =
                compareHistoryService.getCompareHistories(LoginUtil.getMemberId(session)); // 세션 회원의 비교 내역
        return ResponseEntity.ok(ApiResponse.success(Map.of("items", items)));              // "items" 키로 감싸서 200
    }

    // POST /api/me/compares (본문: productAId, productBId, 응답 201)
    @PostMapping
    public ResponseEntity<Void> saveCompareHistory(HttpSession session, @Valid @RequestBody CompareHistoryRequestDTO compareReqDTO) {
        compareHistoryService.saveCompareHistory(LoginUtil.getMemberId(session), compareReqDTO);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    // DELETE /api/me/compares/{compareId} (내 기록 중 그 1건, 응답 204, 없거나 남의 기록은 404)
    @DeleteMapping("/{compareId}")
    public ResponseEntity<Void> deleteCompareHistory(HttpSession session, @PathVariable Long compareId) {
        compareHistoryService.deleteCompareHistory(LoginUtil.getMemberId(session), compareId);
        return ResponseEntity.noContent().build();

    }

    // DELETE /api/me/compares ({compareId} 없음: 내 기록 전체, 응답 204)
    @DeleteMapping
    public ResponseEntity<Void> deleteCompareHistories(HttpSession session) {
        compareHistoryService.deleteCompareHistories(LoginUtil.getMemberId(session));
        return ResponseEntity.noContent().build();
    }
}
