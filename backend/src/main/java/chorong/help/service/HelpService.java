package chorong.help.service;

import java.util.List;

import chorong.help.dto.FeedbackRequestDTO;
import chorong.help.dto.HelpContentResponseDTO;
import chorong.help.dto.QuestionRequestDTO;
import chorong.help.dto.TermAddRequestDTO;
import jakarta.servlet.http.HttpSession;

public interface HelpService {

    // HELP-02 용어 목록 (help_content TERM, help_no 순, 메모리 캐시)
    List<HelpContentResponseDTO> getTerms();

    // HELP-03 금융 TIP 목록 (help_content TIP, help_no 순, 메모리 캐시)
    List<HelpContentResponseDTO> getTips();

    // HELP-01 자주 묻는 질문 목록 (help_content FAQ, help_no 순, 연 횟수 포함, 메모리 캐시)
    List<HelpContentResponseDTO> getFaqs();

    // HELP-01 FAQ 열기: 연 횟수 +1 (helpId = help_content.help_id)
    void openFaq(Long helpId);

    // HELP-07 용어 추가 요청 (term_request: 같은 단어면 횟수 +1, 없으면 추가)
    void addTermRequest(TermAddRequestDTO request);

    // HELP-05 질문 남기기 (help_question 저장). session은 비회원이면 null일 수 있음
    void addQuestion(QuestionRequestDTO request, HttpSession session);

    // HELP-06 도움말 평가 (help_stat 도움돼요, 별로예요 횟수 +1 또는 취소 -1)
    void addFeedback(FeedbackRequestDTO request);
}
