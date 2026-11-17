package chorong.member.controller;

import chorong.common.dto.ApiResponse;
import chorong.member.dto.MemberResponseDTO;
import chorong.member.dto.SignupRequestDTO;
import chorong.member.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/*
 * /api/auth/** : 가입 완료, 로그아웃, 내 정보
 * (소셜 로그인 시작, 확인 주소는 Spring Security가 받음)
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /** MEM-12 가입 완료 */
    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<MemberResponseDTO>> signup(
            @Valid @RequestBody SignupRequestDTO requestDTO, HttpServletRequest request) {
        MemberResponseDTO response = authService.signup(request.getSession(false), requestDTO);
        request.changeSessionId();      // 로그인 성공 시 세션 아이디 새로 발급 (B5)
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /** MEM-02 로그아웃: 로그인 안 돼 있어도 204 */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        authService.logout(request.getSession(false));
        return ResponseEntity.noContent().build();
    }

    /** MEM-03 내 정보 확인 */
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<MemberResponseDTO>> getMe(HttpServletRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.getMe(request.getSession(false))));
    }
}
