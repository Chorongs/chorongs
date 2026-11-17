package chorong.member.service;

import chorong.member.dto.MemberResponseDTO;
import chorong.member.dto.SignupRequestDTO;
import chorong.member.dto.SocialUserDTO;
import jakarta.servlet.http.HttpSession;

public interface AuthService {

    /** 소셜 계정으로 가입한 회원이면 세션에 로그인 정보를 저장하고 true, 아니면 false (MEM-01) */
    boolean login(HttpSession session, SocialUserDTO social);

    /** 신규 회원의 소셜 정보를 가입 대기 세션에 10분 보관 (member는 만들지 않음, MEM-01) */
    void savePendingSignup(HttpSession session, SocialUserDTO social);

    /** 가입 완료: 회원 만들고 로그인 정보 저장 (MEM-12) */
    MemberResponseDTO signup(HttpSession session, SignupRequestDTO request);

    /** 세션에서 회원 로그인 정보만 삭제, 세션이 없어도 오류 없음 (MEM-02) */
    void logout(HttpSession session);

    /** 로그인한 회원 정보, 비로그인과 탈퇴 회원은 401 (MEM-03) */
    MemberResponseDTO getMe(HttpSession session);
}
