package chorong.member.service;

import chorong.member.dto.MemberResponseDTO;
import chorong.member.dto.MemberUpdateRequestDTO;
import chorong.member.dto.MySummaryResponseDTO;

/*
 * 회원 정보 수정, 탈퇴, MY 요약 (MEM-11, MEM-07, MEM-13)
 * 지금은 MY 요약만: 세션 회원 번호로 찜, 최근 본, 비교 내역, 계산 기록 개수 (B3)
 * 계산 기록(calcCount)은 CHORONG-48 병합 전까지 임시로 0
 */
public interface MemberService {

    // MY 요약 (개수 4개)
    MySummaryResponseDTO getMySummary(Long memberId);

    // 회원 탈퇴 (MEM-07): 이용 기록 7종 삭제 → member 정리 (닉네임 '탈퇴한 회원', 출생연도, 생일, login_type, social_id null, member_status 0)
    // 한 번에 처리 @Transactional (B16), 중간 실패 시 전부 되돌림 / 계산 기록 삭제는 CHORONG-48 병합 전까지 건너뜀
    void withdraw(Long memberId);

    // 회원 정보 수정 (MEM-11): 닉네임 (앞뒤 공백 제거, 2~12자), 생년월일 (둘 다, 형식, 미래, 1900년 이전) → 저장, 바꿀 것만 (B2, B3)
    MemberResponseDTO updateMember(Long memberId, MemberUpdateRequestDTO updateDTO);
}
