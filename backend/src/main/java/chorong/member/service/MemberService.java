package chorong.member.service;

import chorong.member.dto.MySummaryResponseDTO;

/*
 * 회원 정보 수정, 탈퇴, MY 요약 (MEM-11, MEM-07, MEM-13)
 * 지금은 MY 요약만: 세션 회원 번호로 찜, 최근 본, 비교 내역, 계산 기록 개수 (B3)
 * 계산 기록(calcCount)은 CHORONG-48 병합 전까지 임시로 0
 */
public interface MemberService {

    // MY 요약 (개수 4개)
    MySummaryResponseDTO getMySummary(Long memberId);
}
