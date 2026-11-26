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
    private int helpNo;                 // 엑셀 원본의 고정 번호
    private String category;            // 분류
    private String title;               // 용어 이름
    private String content;             // 설명 (글자 그대로, HTML로 바꾸지 않음)
    private List<String> keywords;      // 관련 단어 (keyword1~5 중 값이 있는 것만)
    private String summary;
    private Integer openCount;
}
