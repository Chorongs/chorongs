package chorong.member.controller;

import chorong.common.dto.ApiResponse;
import chorong.common.dto.LoginMemberDTO;
import chorong.common.util.LoginUtil;
import chorong.common.util.SessionConst;
import chorong.member.dto.MemberResponseDTO;
import chorong.member.dto.MemberUpdateRequestDTO;
import chorong.member.dto.MySummaryResponseDTO;
import chorong.member.service.MemberService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

    // DELETE /api/me (회원 탈퇴 MEM-07, API-28: 서비스가 성공한 뒤 세션에서 로그인 정보 삭제, 응답 204)
    @DeleteMapping
    public ResponseEntity<Void> withdraw(HttpSession session) {

        memberService.withdraw(LoginUtil.getMemberId(session));
        session.removeAttribute(SessionConst.LOGIN_MEMBER);
        return ResponseEntity.noContent().build();
    }

    // PATCH /api/me (회원 정보 수정 MEM-11, API-28: 본문 nickname, birthYear, birthDay 바꿀 것만, 응답 MemberResponseDTO, 성공 뒤 세션의 로그인 정보도 새 값으로 갱신)
    @PatchMapping
    public ResponseEntity<ApiResponse<MemberResponseDTO>> updateMember(HttpSession session, @Valid @RequestBody MemberUpdateRequestDTO memberUpdateRequestDTO) {
       MemberResponseDTO dto =  memberService.updateMember(LoginUtil.getMemberId(session), memberUpdateRequestDTO);
       LoginMemberDTO loginDTO = new LoginMemberDTO(LoginUtil.getMemberId(session),
               dto.getMemberNickname(), dto.getBirthYear(), dto.getBirthDay());
       session.setAttribute(SessionConst.LOGIN_MEMBER, loginDTO);


        return ResponseEntity.ok(ApiResponse.success(dto));
    }
}
