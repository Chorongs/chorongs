package chorong.help.service;

import java.util.List;

import chorong.help.dto.HelpContentResponseDTO;

public interface HelpService {

    // HELP-02 용어 목록 (help_content TERM, help_no 순, 메모리 캐시)
    List<HelpContentResponseDTO> getTerms();

    // HELP-03 금융 TIP 목록 (help_content TIP, help_no 순, 메모리 캐시)
    List<HelpContentResponseDTO> getTips();

    // HELP-01 자주 묻는 질문 목록 (help_content FAQ, help_no 순, 연 횟수 포함, 메모리 캐시)
    List<HelpContentResponseDTO> getFaqs();

    // HELP-01 FAQ 열기: 연 횟수 +1 (helpId = help_content.help_id)
    void openFaq(Long helpId);
}
