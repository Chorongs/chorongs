package chorong.help.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class HelpContentResponseDTO {

    private Long helpId;
    private Integer helpNo;             // 엑셀 원본의 고정 번호
    private String category;            // 분류
    private String title;               // 이름 (FAQ에서는 질문)
    private String content;             // 설명 (FAQ에서는 답변)
    private List<String> keywords;      // 관련 단어
    private String summary;
    private Long openCount;             //FAQ 조회수
}
