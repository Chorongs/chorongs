package chorong.help.service;

import java.util.List;

import chorong.help.dto.HelpContentResponseDTO;

public interface HelpService {

    // HELP-02 용어 목록 (help_content TERM, help_no 순, 메모리 캐시)
    List<HelpContentResponseDTO> getTerms();
}
