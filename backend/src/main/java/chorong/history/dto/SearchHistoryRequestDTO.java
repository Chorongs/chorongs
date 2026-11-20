package chorong.history.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 최근 검색 기록 요청 (MEM-09): type (FILTER, SIMPLE), label (화면 글, 200자), condition (다시 검색할 조건 JSON 글, 길이 제한)
 */
@Data
@NoArgsConstructor
public class SearchHistoryRequestDTO {
    @NotBlank(message = "값을 입력해주세요")
    @Pattern(regexp = "FILTER|SIMPLE")
    private String type;
    @NotBlank(message = "값을 입력해주세요")
    @Size(max = 200)
    private String label;
    @NotBlank(message = "값을 입력해주세요")
    private String condition;

}
