package chorong.help.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import chorong.common.dto.ApiResponse;
import chorong.help.dto.HelpContentResponseDTO;
import chorong.help.service.HelpService;
import lombok.RequiredArgsConstructor;

/*
 * 도움말 /api/help/** (권한: 모두)
 * HELP-02: GET /api/help/terms 용어 목록
 * HELP-01, 03, 05~08은 이 컨트롤러에 메서드를 추가해 감
 */
@RestController
@RequestMapping("/api/help")
@RequiredArgsConstructor
public class HelpController {

    private final HelpService helpService;

    @GetMapping("/terms")
    public ResponseEntity<ApiResponse<List<HelpContentResponseDTO>>> getTerms() {
        return ResponseEntity.ok(ApiResponse.success(helpService.getTerms()));
    }
}
