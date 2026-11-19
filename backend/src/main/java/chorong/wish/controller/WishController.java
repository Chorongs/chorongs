package chorong.wish.controller;

import chorong.common.dto.ApiResponse;
import chorong.common.dto.PageInfo;
import chorong.common.util.LoginUtil;
import chorong.wish.dto.WishResponseDTO;
import chorong.wish.service.WishService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/*
 * 찜 (MEM-04, API-20): GET /api/me/likes, POST /api/me/likes/{productId}, DELETE /api/me/likes/{productId}
 * 권한: 회원 (로그인 확인은 LoginInterceptor, 회원 번호는 세션에서만 꺼냄, B3)
 */
@RestController
@RequestMapping("/api/me/likes")
@RequiredArgsConstructor
public class WishController {
    private final WishService wishService;
    // GET /api/me/likes (page, size)
    @GetMapping                                                                   // "/" 를 지움: 주소를 /api/me/likes 로
    public ResponseEntity<ApiResponse<PageInfo<WishResponseDTO>>> getWishes(
            HttpSession session,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                wishService.getWishes(LoginUtil.getMemberId(session), page, size)));
    }
    @PostMapping("/{productId}")
    public ResponseEntity<Void> saveWish(HttpSession session, @PathVariable Long productId) {
        wishService.saveWish(LoginUtil.getMemberId(session), productId);

        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    // DELETE /api/me/likes/{productId}
    public void deleteWish() {
    }
}
