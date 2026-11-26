package chorong.help.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.MemoryCache;
import chorong.help.entity.HelpContent;
import chorong.help.entity.HelpStat;
import chorong.help.entity.HelpType;
import chorong.help.repository.HelpContentRepository;
import chorong.help.repository.HelpStatRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import chorong.help.dto.HelpContentResponseDTO;
import lombok.RequiredArgsConstructor;


@Service
@RequiredArgsConstructor
public class HelpServiceImpl implements HelpService {
    private final HelpContentRepository helpContentRepository;
    private final MemoryCache  memoryCache;
    private final HelpStatRepository helpStatRepository;
    private static final String CACHE_TERM_KEY = "terms";
    private static final String CACHE_TIP_KEY = "tips";
    private static final String CACHE_FAQ_KEY = "faqs";

    @Override
    @Transactional(readOnly = true)
    public List<HelpContentResponseDTO> getTerms() {
        Object cacheList = memoryCache.get(MemoryCache.TERM, CACHE_TERM_KEY);
        if(cacheList instanceof List<?>) {
            return ((List<?>) cacheList).stream().map(HelpContentResponseDTO.class::cast).toList();
        }

        List<HelpContent> termList = helpContentRepository.findByHelpTypeOrderByHelpNoAsc(HelpType.TERM);
        List<HelpContentResponseDTO> responseDTOList = new ArrayList<>();


        for (HelpContent helpContent : termList) {
            List<String> keywords = Stream.of(helpContent.getKeyword1(),
                    helpContent.getKeyword2(), helpContent.getKeyword3(), helpContent.getKeyword4(), helpContent.getKeyword5())
                    .filter(Objects::nonNull).toList();
            responseDTOList.add(new HelpContentResponseDTO
                    (helpContent.getHelpId(), helpContent.getHelpNo(), helpContent.getCategory(),
                            helpContent.getTitle(), helpContent.getContent(), keywords, null, null));
        }
        List<HelpContentResponseDTO> copyList = List.copyOf(responseDTOList);
        memoryCache.put(MemoryCache.TERM, CACHE_TERM_KEY, copyList);
        return copyList;
    }


    @Override
    @Transactional(readOnly = true)
    public List<HelpContentResponseDTO> getTips() {
        Object cacheList = memoryCache.get(MemoryCache.TIP, CACHE_TIP_KEY);
        if(cacheList instanceof List<?>) {
            return ((List<?>) cacheList).stream().map(HelpContentResponseDTO.class::cast).toList();
        }

        List<HelpContent> tipList = helpContentRepository.findByHelpTypeOrderByHelpNoAsc(HelpType.TIP);
        List<HelpContentResponseDTO> responseDTOList = new ArrayList<>();
        for (HelpContent tips : tipList) {
            List<String> keywords = Stream.of(tips.getKeyword1(), tips.getKeyword2(),
                    tips.getKeyword3(), tips.getKeyword4(), tips.getKeyword5()).filter(Objects::nonNull).toList();
            responseDTOList.add(new HelpContentResponseDTO(tips.getHelpId(), tips.getHelpNo(), tips.getCategory(),
                    tips.getTitle(), tips.getContent(), keywords, tips.getSummary(), null));
        }
        List<HelpContentResponseDTO> copyList = List.copyOf(responseDTOList);
        memoryCache.put(MemoryCache.TIP, CACHE_TIP_KEY, copyList);

        return copyList;
    }


    @Override
    @Transactional(readOnly = true)
    public List<HelpContentResponseDTO> getFaqs() {
    Object cacheList = memoryCache.get(MemoryCache.FAQ, CACHE_FAQ_KEY);
        if(cacheList instanceof List<?>) {
            return ((List<?>) cacheList).stream().map(HelpContentResponseDTO.class::cast).toList();
        }
        List<HelpContent> faqList = helpContentRepository.findByHelpTypeOrderByHelpNoAsc(HelpType.FAQ);
        List<HelpContentResponseDTO> responseDTOList = new ArrayList<>();
        for (HelpContent faqs : faqList) {

            Optional<HelpStat> faqsStat = helpStatRepository.findByTargetKeyAndTargetType( faqs.getHelpId().toString(), HelpType.FAQ);
            int openCount = faqsStat.map(HelpStat::getOpenCount).orElse(0);

            responseDTOList.add(new HelpContentResponseDTO(faqs.getHelpId(), faqs.getHelpNo(), faqs.getCategory(),
                    faqs.getTitle(), faqs.getContent(), null, null, openCount));
        }

        List<HelpContentResponseDTO> copyList = List.copyOf(responseDTOList);
        memoryCache.put(MemoryCache.FAQ, CACHE_FAQ_KEY, copyList);

        return copyList;
    }

    /*
     * HELP-01 FAQ 열기 처리 순서 (be_help.md: help_stat open_count + 1, 없으면 행 추가)
     * 1. help_content에서 helpId 행을 찾고 FAQ인지 확인 (없거나 FAQ가 아닐 때의 응답은 명세서에 없음, 정할 것)
     * 2. help_stat에서 (FAQ, helpId 문자열) 행의 open_count + 1 (HelpStatRepository에 메서드 추가)
     * 3. 그 행이 없으면 open_count 1로 새 행 추가
     * 4. FAQ 목록 캐시에 옛 연 횟수가 남지 않게 처리
     */
    @Override
    @Transactional
    public void openFaq(Long helpId) {
        HelpContent faqsStat = helpContentRepository.findByHelpTypeAndHelpId(HelpType.FAQ, helpId)
                .orElseThrow(()-> new BusinessException(ErrorCode.NOT_FOUND));
        int increaseOpenCount = helpStatRepository.increaseViewCount(faqsStat.getHelpId().toString());
        if(increaseOpenCount == 0) {
            HelpStat saveHelpStat = HelpStat.builder()
                    .targetType(HelpType.FAQ)
                    .targetKey(faqsStat.getHelpId().toString())
                    .openCount(1)
                    .helpfulCount(0)
                    .unhelpfulCount(0)
                    .build();
            try {
                helpStatRepository.save(saveHelpStat);
            }catch (DataIntegrityViolationException e) {
                throw new BusinessException(ErrorCode.CONFLICT);
            }
        }
        memoryCache.clear(MemoryCache.FAQ);
    }
}
