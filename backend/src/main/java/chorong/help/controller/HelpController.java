package chorong.help.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.common.dto.ApiResponse;
import chorong.common.util.RequestLimiter;
import chorong.help.dto.HelpContentResponseDTO;
import chorong.help.service.HelpService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;

/*
 * 도움말 /api/help/** (권한: 모두)
 * HELP-01: GET /api/help/faqs FAQ 목록, POST /api/help/faqs/{id}/open 연 횟수 +1 ({id} = helpId, 204, 반복 429)
 * HELP-02: GET /api/help/terms 용어 목록
 * HELP-03: GET /api/help/tips TIP 목록
 * HELP-05~08은 이 컨트롤러에 메서드를 추가해 감
 */
@RestController
@RequestMapping("/api/help")
@RequiredArgsConstructor
public class HelpController {

    private final HelpService helpService;
    private final RequestLimiter requestLimiter;

    @GetMapping("/terms")
    public ResponseEntity<ApiResponse<List<HelpContentResponseDTO>>> getTerms() {
        return ResponseEntity.ok(ApiResponse.success(helpService.getTerms()));
    }

    @GetMapping("/tips")
    public ResponseEntity<ApiResponse<List<HelpContentResponseDTO>>> getTips() {
        return ResponseEntity.ok(ApiResponse.success(helpService.getTips()));
    }

    @GetMapping("/faqs")
    public ResponseEntity<ApiResponse<List<HelpContentResponseDTO>>> getFaqs() {
        return ResponseEntity.ok(ApiResponse.success(helpService.getFaqs()));
    }

    // 같은 사람이 1분에 10회 넘게 열면 429 (B10)
    @PostMapping("/faqs/{id}/open")
    public ResponseEntity<Void> openFaq(@PathVariable Long id, HttpServletRequest request) {
        requestLimiter.check("faqOpen", request);
        helpService.openFaq(id);
        return ResponseEntity.noContent().build();
    }
}
