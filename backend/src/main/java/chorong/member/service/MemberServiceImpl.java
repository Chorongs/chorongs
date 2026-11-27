package chorong.member.service;

import chorong.calculator.repository.*;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.credit.repository.DiagnosisReportRepository;
import chorong.history.repository.CompareHistoryRepository;
import chorong.history.repository.RecentViewRepository;
import chorong.history.repository.SearchHistoryRepository;
import chorong.member.dto.MemberResponseDTO;
import chorong.member.dto.MemberUpdateRequestDTO;
import chorong.member.dto.MySummaryResponseDTO;
import chorong.member.entity.Member;
import chorong.member.repository.MemberRepository;
import chorong.recommend.repository.RecommendResultRepository;
import chorong.wish.repository.WishRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.DateTimeException;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class MemberServiceImpl implements MemberService {
    private static final int MIN_BIRTH_YEAR = 1900;
    private static final int MIN_AGE = 19;

    private final WishRepository wishRepository;
    private final RecentViewRepository recentViewRepository;
    private final CompareHistoryRepository compareHistoryRepository;
    private final SearchHistoryRepository searchHistoryRepository;
    private final RecommendResultRepository recommendResultRepository;
    private final DiagnosisReportRepository diagnosisReportRepository;
    private final MemberRepository memberRepository;
    private final CalcHistoryRepository calcHistoryRepository;
    private final DsrCalcHistoryRepository  dsrCalcHistoryRepository;
    private final ChangeCalcHistoryRepository changeCalcHistory;
    private final HomeLimitCalcHistoryRepository homeLimitCalcHistory;
    private final ReverseCalcHistoryRepository reverseCalcHistoryRepository;
    private final DsrLoanRepository dsrLoanRepository;
    private final HomeOtherLoanRepository homeOtherLoanRepository;


    @Override
    @Transactional(readOnly = true)
    public MySummaryResponseDTO getMySummary(Long memberId) {
        return new MySummaryResponseDTO(wishRepository.countByMemberId(memberId),
                recentViewRepository.countByMemberId(memberId),
                compareHistoryRepository.countByMemberId(memberId),
                calcHistoryRepository.countByMemberId(memberId),
                dsrCalcHistoryRepository.countByMemberId(memberId),
                changeCalcHistory.countByMemberId(memberId),
                homeLimitCalcHistory.countByMemberId(memberId),
                reverseCalcHistoryRepository.countByMemberId(memberId));

    }

    @Override
    @Transactional
    public void withdraw(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        wishRepository.deleteByMemberId(memberId);
        recentViewRepository.deleteByMemberId(memberId);
        searchHistoryRepository.deleteByMemberId(memberId);
        compareHistoryRepository.deleteByMemberId(memberId);
        recommendResultRepository.deleteByMemberId(memberId);
        diagnosisReportRepository.findByMemberId(memberId).ifPresent(diagnosisReportRepository::delete);
        calcHistoryRepository.deleteByMemberId(memberId);
        dsrLoanRepository.deleteByMemberId(memberId);
        dsrCalcHistoryRepository.deleteByMemberId(memberId);
        changeCalcHistory.deleteByMemberId(memberId);
        homeOtherLoanRepository.deleteByMemberId(memberId); // 집 살 때 대출한도의 다른 대출 행 먼저 (fk_home_other_loan_calc, CHORONG-54)
        homeLimitCalcHistory.deleteByMemberId(memberId);
        reverseCalcHistoryRepository.deleteByMemberId(memberId);


        member.withdraw();
    }

    @Override
    @Transactional
    public MemberResponseDTO updateMember(Long memberId, MemberUpdateRequestDTO updateDTO) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));

        // 닉네임: 직접 작성 (값이 있을 때만, 앞뒤 공백 제거 후 2~12자, 아니면 400)

        if(updateDTO.getMemberNickname() != null) {
            String nickname = updateDTO.getMemberNickname().trim();
            if(nickname.length() > 12 || nickname.length() < 2) {
                throw new BusinessException(ErrorCode.INVALID_INPUT);
            }
            updateDTO.setMemberNickname(nickname);
        }else {
            updateDTO.setMemberNickname(member.getMemberNickname());
        }

        // 생년월일: 하나라도 보냈으면 둘 다 있어야 하고 (아니면 400), 검사를 통과하면 바꿈
        if (updateDTO.getBirthYear() != null || updateDTO.getBirthDay() != null) {
            validateBirth(updateDTO.getBirthYear(), updateDTO.getBirthDay());
        }else {
            updateDTO.setBirthDay(member.getBirthDay());
            updateDTO.setBirthYear(member.getBirthYear());
        }

        member.updateMemberInfo(updateDTO.getMemberNickname(), updateDTO.getBirthYear(), updateDTO.getBirthDay());
        return MemberResponseDTO.from(member);
    }

    // 생년월일: 둘 다 있고, 실제 있는 날짜이고, 1900년 이후이고, 미래가 아니고, 만 19세 이상이어야 함 (아니면 400)
    private void validateBirth(String birthYear, String birthDay) {
        if (birthYear == null || birthDay == null) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
        try {
            String[] monthDay = birthDay.split("-");
            int year = Integer.parseInt(birthYear);
            LocalDate birth = LocalDate.of(year, Integer.parseInt(monthDay[0]), Integer.parseInt(monthDay[1]));
            LocalDate today = LocalDate.now();
            if (year < MIN_BIRTH_YEAR || birth.isAfter(today)) {
                throw new BusinessException(ErrorCode.INVALID_INPUT);
            }
            // 만 나이 (가입과 같은 계산: 올해 생일이 아직 안 지났으면 1살 뺌), 미성년자는 400
            int age = today.getYear() - birth.getYear();
            if (today.isBefore(birth.withYear(today.getYear()))) {
                age--;
            }
            if (age < MIN_AGE) {
                throw new BusinessException(ErrorCode.INVALID_INPUT);
            }
        } catch (NumberFormatException | ArrayIndexOutOfBoundsException | DateTimeException e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT);
        }
    }
}
