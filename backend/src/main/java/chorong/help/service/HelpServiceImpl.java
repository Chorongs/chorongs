package chorong.help.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.LoginUtil;
import chorong.common.util.MemoryCache;
import chorong.help.entity.*;
import chorong.help.repository.HelpContentRepository;
import chorong.help.repository.HelpQuestionRepository;
import chorong.help.repository.HelpStatRepository;
import chorong.help.repository.TermRequestRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import chorong.help.dto.FeedbackRequestDTO;
import chorong.help.dto.HelpContentResponseDTO;
import chorong.help.dto.QuestionRequestDTO;
import chorong.help.dto.TermAddRequestDTO;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;


@Service
@RequiredArgsConstructor
public class HelpServiceImpl implements HelpService {
    private final HelpContentRepository helpContentRepository;
    private final MemoryCache  memoryCache;
    private final HelpStatRepository helpStatRepository;
    private final TermRequestRepository termRequestRepository;
    private final HelpQuestionRepository helpQuestionRepository;
    private static final String CACHE_TERM_KEY = "terms";
    private static final String CACHE_TIP_KEY = "tips";
    private static final String CACHE_FAQ_KEY = "faqs";

//    HELP-02
    @Override
    @Transactional(readOnly = true)
    public List<HelpContentResponseDTO> getTerms() {
        Object cacheList = memoryCache.get(MemoryCache.TERM, CACHE_TERM_KEY);
        if(cacheList instanceof List<?>) {
            return ((List<?>) cacheList).stream().map(HelpContentResponseDTO.class::cast).toList();
        }

        List<HelpContent> termList = helpContentRepository.findByHelpTypeOrderByHelpNoAsc(HelpType.TERM);
        List<HelpContentResponseDTO> responseDTOList = new ArrayList<>();


        for (HelpContent term : termList) {
            List<String> keywords = Stream.of(term.getKeyword1(),
                    term.getKeyword2(), term.getKeyword3(), term.getKeyword4(), term.getKeyword5())
                    .filter(Objects::nonNull).toList();
            responseDTOList.add(new HelpContentResponseDTO
                    (term.getHelpId(), term.getHelpNo(), term.getCategory(),
                            term.getTitle(), term.getContent(), keywords, null, null));
        }
        List<HelpContentResponseDTO> copyList = List.copyOf(responseDTOList);
        memoryCache.put(MemoryCache.TERM, CACHE_TERM_KEY, copyList);
        return copyList;
    }

    //    HELP-03
    @Override
    @Transactional(readOnly = true)
    public List<HelpContentResponseDTO> getTips() {
        Object cacheList = memoryCache.get(MemoryCache.TIP, CACHE_TIP_KEY);
        if(cacheList instanceof List<?>) {
            return ((List<?>) cacheList).stream().map(HelpContentResponseDTO.class::cast).toList();
        }

        List<HelpContent> tipList = helpContentRepository.findByHelpTypeOrderByHelpNoAsc(HelpType.TIP);
        List<HelpContentResponseDTO> responseDTOList = new ArrayList<>();
        for (HelpContent tip : tipList) {
            List<String> keywords = Stream.of(tip.getKeyword1(), tip.getKeyword2(),
                    tip.getKeyword3(), tip.getKeyword4(), tip.getKeyword5()).filter(Objects::nonNull).toList();
            responseDTOList.add(new HelpContentResponseDTO(tip.getHelpId(), tip.getHelpNo(), tip.getCategory(),
                    tip.getTitle(), tip.getContent(), keywords, tip.getSummary(), null));
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
        for (HelpContent faq : faqList) {

            Optional<HelpStat> faqStat = helpStatRepository.findByTargetKeyAndTargetType( faq.getHelpId().toString(), HelpType.FAQ);
            Long openCount = faqStat.map(HelpStat::getOpenCount).orElse(0L);

            responseDTOList.add(new HelpContentResponseDTO(faq.getHelpId(), faq.getHelpNo(), faq.getCategory(),
                    faq.getTitle(), faq.getContent(), null, null, openCount));
        }

        List<HelpContentResponseDTO> copyList = List.copyOf(responseDTOList);
        memoryCache.put(MemoryCache.FAQ, CACHE_FAQ_KEY, copyList);

        return copyList;
    }

//     HELP-01 FAQ 열기
    @Override
    @Transactional
    public void openFaq(Long helpId) {
        HelpContent faq = helpContentRepository.findByHelpTypeAndHelpId(HelpType.FAQ, helpId)
                .orElseThrow(()-> new BusinessException(ErrorCode.NOT_FOUND));
        int updatedRows = helpStatRepository.increaseOpenCount(faq.getHelpId().toString());
        if(updatedRows == 0) {
            HelpStat newStat = HelpStat.builder()
                    .targetType(HelpType.FAQ)
                    .targetKey(faq.getHelpId().toString())
                    .openCount(1L)
                    .helpfulCount(0L)
                    .unhelpfulCount(0L)
                    .build();
            try {
                helpStatRepository.save(newStat);
            }catch (DataIntegrityViolationException e) {
                throw new BusinessException(ErrorCode.CONFLICT);
            }
        }
        memoryCache.clear(MemoryCache.FAQ);
    }


//     HELP-07 용어 추가 요청

    @Override
    @Transactional
    public void addTermRequest(TermAddRequestDTO request) {
        String word = request.getWord().strip();
        Optional<TermRequest> termRequest = termRequestRepository.findByTermWord(word);
        if(termRequest.isPresent()) {
            //값이 있으면 카운트 증가, 마지막 요청 날짜 변경
            TermRequest existing = termRequest.get();
                existing.addRequest(1, LocalDateTime.now().withNano(0));

        }else {
            //값이 없다면 새로 저장
            TermRequest newRequest = TermRequest.builder()
                    .termWord(word)
                    .requestCount(1)
                    .createdAt(LocalDateTime.now().withNano(0))
                    .lastRequestedAt(LocalDateTime.now().withNano(0))
                    .build();
            try {
                termRequestRepository.save(newRequest);
            }catch (DataIntegrityViolationException e) {
                throw new BusinessException(ErrorCode.CONFLICT);
            }
        }
    }


        //HELP-05 질문 남기기
    @Override
    @Transactional
    public void addQuestion(QuestionRequestDTO request, HttpSession session) {
        String content = request.getContent().strip();
        if(content.length() > 300 || content.length() < 4)  throw new BusinessException(ErrorCode.INVALID_INPUT);
        String memberYn = LoginUtil.getLoginMember(session) == null ? "N" : "Y";

        HelpQuestion helpQuestion = HelpQuestion.builder()
                .content(content)
                .memberYn(memberYn)
                .questionStatus(QuestionStatus.PENDING)
                .createdAt(LocalDateTime.now().withNano(0))
                .build();
        try {
            helpQuestionRepository.save(helpQuestion);
        }catch (DataIntegrityViolationException e) {
            throw new BusinessException(ErrorCode.CONFLICT);
        }
    }

//    HELP-06 도움말 평가

    @Override
    @Transactional
    public void addFeedback(FeedbackRequestDTO request) {

        //help_content에 type과 type_key가 매칭되는 행이 있는지 확인
        helpContentRepository.findByHelpTypeAndHelpId(request.getType(), request.getTargetKey())
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
        //행이 없을 경우 추가, 있을 경우 값 변경
        Optional<HelpStat> helpStat = helpStatRepository
                .findByTargetKeyAndTargetType(request.getTargetKey().toString(), request.getType());
        if(request.getCancel() == null) request.setCancel(false);
        if(helpStat.isEmpty()) {
                //행 추가
            HelpStat addHelpStat;
                 addHelpStat = HelpStat.builder()
                        .targetType(request.getType())
                        .targetKey(request.getTargetKey().toString())
                        .openCount(0L)
                        .helpfulCount(request.getVote().equals(Vote.UP) && !request.getCancel() ? 1L : 0L)
                        .unhelpfulCount(request.getVote().equals(Vote.DOWN) && !request.getCancel() ? 1L : 0L)
                        .build();

            try {
                helpStatRepository.save(addHelpStat);
            }catch (DataIntegrityViolationException e) {
                throw new BusinessException(ErrorCode.CONFLICT);
            }
        }else {
            //업 다운
            if(request.getVote().equals(Vote.UP)) {
                helpStat.get().requestHelpfulCount(1, request.getCancel());
            }else{
                helpStat.get().requestUnhelpfulCount(1, request.getCancel());
            }
        }
    }
}
