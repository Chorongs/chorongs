package chorong.member.controller;

import chorong.common.dto.ApiResponse;
import chorong.common.util.LoginUtil;
import chorong.member.dto.MySummaryResponseDTO;
import chorong.member.service.MemberService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/*
 * 회원 (MEM-13 MY 요약, API-51): GET /api/me/summary
 * 권한: 회원 (로그인 확인은 LoginInterceptor, 회원 번호는 세션에서만 꺼냄, B3)
 * MEM-07 탈퇴, MEM-11 정보 수정도 이 컨트롤러에 들어감 (지금은 MY 요약만)
 */
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MemberController {
    private final MemberService memberService;
    // GET /api/me/summary (wishCount, recentViewCount, compareCount, calcCount)
    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<MySummaryResponseDTO>> getMySummary(HttpSession session) {
        MySummaryResponseDTO mySummaryResponseDTO = memberService.getMySummary(LoginUtil.getMemberId(session));
        return ResponseEntity.ok(ApiResponse.success(mySummaryResponseDTO));
    }
}
