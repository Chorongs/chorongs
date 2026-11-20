package chorong.member.service;

import chorong.history.repository.CompareHistoryRepository;
import chorong.history.repository.RecentViewRepository;
import chorong.member.dto.MySummaryResponseDTO;
import chorong.wish.repository.WishRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MemberServiceImpl implements MemberService {
    private final WishRepository wishRepository;
    private final RecentViewRepository recentViewRepository;
    private final CompareHistoryRepository compareHistoryRepository;

    @Override
    @Transactional(readOnly = true)
    public MySummaryResponseDTO getMySummary(Long memberId) {
        return new MySummaryResponseDTO(wishRepository.countByMemberId(memberId),
                recentViewRepository.countByMemberId(memberId),
                compareHistoryRepository.countByMemberId(memberId),
                0);
                //현재 calcRepository와 미병합 및 count 메서드 부재로 임시로 0 반환
    }
}
