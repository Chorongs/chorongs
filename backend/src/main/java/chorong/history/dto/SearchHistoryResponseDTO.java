package chorong.history.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/*
 * 최근 검색 응답 한 줄 (MEM-09): searchId, searchType, searchLabel, searchCondition (다시 검색할 조건 JSON 글), searchedAt
 * GET 응답 data는 items (최근 10개)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchHistoryResponseDTO {
    private Long searchId;
    private String searchType;
    private String searchLabel;
    private String searchCondition;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm", timezone = "Asia/Seoul")
    private LocalDateTime searchedAt;
}
