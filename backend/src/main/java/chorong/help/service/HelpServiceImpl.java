package chorong.help.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.help.dto.HelpContentResponseDTO;
import lombok.RequiredArgsConstructor;

/*
 * HELP-02 용어 사전 처리 순서 (be_help.md)
 * 1. 메모리 캐시(MemoryCache.TERM)에 목록이 있으면 그대로 반환 (B10)
 * 2. 없으면 help_content에서 help_type = TERM 인 행을 help_no 순으로 조회 (HelpContentRepository에 메서드 추가)
 * 3. 각 행을 HelpContentResponseDTO로 바꿈 (keyword1~5 중 값이 있는 것만 keywords에 담음, 글은 HTML로 바꾸지 않고 그대로)
 * 4. 목록은 List.copyOf로 복사해 캐시에 저장하고 반환
 * 필요한 것(직접 주입): HelpContentRepository, MemoryCache
 * TODO: HelpType enum 만들기 (be_common.md 코드 값 타입: help/entity/HelpType, HelpContent.helpType에 @Enumerated(EnumType.STRING))
 */
@Service
@RequiredArgsConstructor
public class HelpServiceImpl implements HelpService {

    @Override
    @Transactional(readOnly = true)
    public List<HelpContentResponseDTO> getTerms() {
        // TODO: 위 처리 순서대로 직접 작성
        throw new UnsupportedOperationException("HELP-02 아직 구현 전");
    }
}
