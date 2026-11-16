package chorong.member.service;

import chorong.common.dto.LoginMemberDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.AdminUtil;
import chorong.common.util.LoginUtil;
import chorong.common.util.SessionConst;
import chorong.member.dto.MemberResponseDTO;
import chorong.member.dto.SignupRequestDTO;
import chorong.member.dto.SocialUserDTO;
import chorong.member.entity.Member;
import chorong.member.repository.MemberRepository;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;


@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final long PENDING_MINUTES = 10;     // 가입 대기 보관 시간
    private static final int MIN_BIRTH_YEAR = 1900;

    private final MemberRepository memberRepository;

    @Override
    @Transactional(readOnly = true)
    public boolean login(HttpSession session, SocialUserDTO social) {
        // 탈퇴 회원은 login_type, social_id가 비어 있어 찾아지지 않음 → 신규로 처리
        return memberRepository.findByLoginTypeAndSocialId(social.getLoginType(), social.getSocialId())
                .map(member -> {
                    session.removeAttribute(SessionConst.PENDING_SIGNUP);
                    saveLoginMember(session, member);
                    return true;
                })
                .orElse(false);
    }

    @Override
    public void savePendingSignup(HttpSession session, SocialUserDTO social) {
        social.setPendingAt(LocalDateTime.now());
        session.setAttribute(SessionConst.PENDING_SIGNUP, social);
    }

    @Override
    @Transactional
    public MemberResponseDTO signup(HttpSession session, SignupRequestDTO request) {
        //가입 대기 세션 확인
        SocialUserDTO social = getPendingSignup(session);

        //관리자로 로그인 중이면 막음
        if (AdminUtil.getLoginAdmin(session) != null) {
            throw new BusinessException(ErrorCode.ADMIN_LOGGED_IN);
        }

        //필수 약관 동의 확인
        if (!Boolean.TRUE.equals(request.getTermsAgreed())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }

        //생년월일: 직접 입력받는 경우만 요청 값 확인, 아니면 네이버 값
        String birthYear = social.getBirthYear();
        String birthDay = social.getBirthDay();
        if (social.needBirth()) {
            validateBirth(request.getBirthYear(), request.getBirthDay());
            birthYear = request.getBirthYear();
            birthDay = request.getBirthDay();
        }

        // member 만들기 (이미 있으면 새로 만들지 않고 그 회원으로 로그인, B9)
        String finalBirthYear = birthYear;
        String finalBirthDay = birthDay;
        Member member = memberRepository.findByLoginTypeAndSocialId(social.getLoginType(), social.getSocialId())
                .orElseGet(() -> memberRepository.save(social.toEntity(finalBirthYear, finalBirthDay)));

        //가입 대기 지우고 로그인 정보 저장 (세션 아이디 새로 발급은 Controller)
        session.removeAttribute(SessionConst.PENDING_SIGNUP);
        saveLoginMember(session, member);
        return MemberResponseDTO.from(member);
    }

    @Override
    public void logout(HttpSession session) {
        if (session != null) {
            session.removeAttribute(SessionConst.LOGIN_MEMBER);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public MemberResponseDTO getMe(HttpSession session) {
        Long memberId = LoginUtil.getMemberId(session);     // 비로그인 401
        Member member = memberRepository.findById(memberId)
                .filter(m -> m.getMemberStatus() == 1)
                .orElse(null);
        if (member == null) {                                // 탈퇴 회원 → 세션 끊고 401
            session.removeAttribute(SessionConst.LOGIN_MEMBER);
            throw new BusinessException(ErrorCode.LOGIN_REQUIRED);
        }
        return MemberResponseDTO.from(member);
    }

    // 가입 대기가 없거나 10분 지났으면 400 SIGNUP_EXPIRED
    private SocialUserDTO getPendingSignup(HttpSession session) {
        if (session == null) {
            throw new BusinessException(ErrorCode.SIGNUP_EXPIRED);
        }
        if (!(session.getAttribute(SessionConst.PENDING_SIGNUP) instanceof SocialUserDTO social)) {
            throw new BusinessException(ErrorCode.SIGNUP_EXPIRED);
        }
        if (social.getPendingAt() == null || social.getPendingAt().plusMinutes(PENDING_MINUTES).isBefore(LocalDateTime.now())) {
            session.removeAttribute(SessionConst.PENDING_SIGNUP);
            throw new BusinessException(ErrorCode.SIGNUP_EXPIRED);
        }
        return social;
    }

    // 생년월일: 둘 다 있고, 실제 있는 날짜이고, 1900년 이후이고, 미래가 아니어야 함 (아니면 400)
    private void validateBirth(String birthYear, String birthDay) {
        if (birthYear == null || birthDay == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        try {
            String[] monthDay = birthDay.split("-");
            int year = Integer.parseInt(birthYear);
            LocalDate birth = LocalDate.of(year, Integer.parseInt(monthDay[0]), Integer.parseInt(monthDay[1]));
            if (year < MIN_BIRTH_YEAR || birth.isAfter(LocalDate.now())) {
                throw new BusinessException(ErrorCode.INVALID_INPUT);
            }
        } catch (NumberFormatException | ArrayIndexOutOfBoundsException | DateTimeException e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
    }

    private void saveLoginMember(HttpSession session, Member member) {
        session.setAttribute(SessionConst.LOGIN_MEMBER, new LoginMemberDTO(
                member.getMemberId(), member.getMemberNickname(), member.getBirthYear(), member.getBirthDay()));
    }
}
