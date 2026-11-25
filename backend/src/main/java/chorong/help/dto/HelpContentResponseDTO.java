package chorong.help.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 도움말 응답 한 줄 (FAQ, 용어, TIP 공통): help_content 한 행
 * 용어(HELP-02): helpNo, category 분류, title 이름, content 설명, keywords 관련 단어
 * TODO: 칸 이름은 명세서에 없음 (프론트 담당과 맞출 것). 지금은 엔티티 칸 이름을 그대로 씀
 * TODO: HELP-03에서 summary(TIP 한 줄 설명), HELP-01에서 openCount(FAQ 연 횟수) 칸을 추가
 * 목록 칸(keywords)에 entity, service 필드의 목록을 담을 때는 List.copyOf(목록)으로 복사해 담는다 (backend/Skills.md, dto 패키지 SpotBugs 제외 구역)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HelpContentResponseDTO {

    private int helpNo;                 // 엑셀 원본의 고정 번호
    private String category;            // 분류
    private String title;               // 용어 이름
    private String content;             // 설명 (글자 그대로, HTML로 바꾸지 않음)
    private List<String> keywords;      // 관련 단어 (keyword1~5 중 값이 있는 것만)
}
