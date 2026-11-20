package chorong.history.controller;

import jakarta.servlet.http.HttpSession;
import org.springframework.web.bind.annotation.*;

/*
 * 비교 내역 (MEM-10, API-23): GET /api/me/compares, POST /api/me/compares, DELETE /api/me/compares/{compareId}
 * 권한: 회원 (로그인 확인은 LoginInterceptor, 회원 번호는 세션에서만 꺼냄, B3)
 */
@RestController
@RequestMapping("/api/me/compares")
public class CompareHistoryController {
    // GET /api/me/compares (최근 비교 10개, 응답 data는 items)
    @GetMapping
    public void getCompareHistories(HttpSession session) {
    }

    // POST /api/me/compares (본문: productAId, productBId, 응답 201)
    @PostMapping
    public void saveCompareHistory(HttpSession session) {
    }

    // DELETE /api/me/compares/{compareId} (내 기록 중 그 1건, 응답 204, 없거나 남의 기록은 404)
    @DeleteMapping("/compareId")
    public void deleteCompareHistory(HttpSession session) {

    }

    // DELETE /api/me/compares ({compareId} 없음: 내 기록 전체, 응답 204)
    @DeleteMapping
    public void deleteCompareHistories(HttpSession session) {
    }
}
