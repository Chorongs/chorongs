package chorong.member.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * MY 요약 응답 (MEM-13): wishCount (찜), recentViewCount (최근 본), compareCount (비교 내역), calcCount (계산 기록)
 * 찜 개수는 판매 종료, 숨김 상품 포함
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MySummaryResponseDTO {
    private long wishCount;
    private long recentViewCount;
    private long compareCount;
    private long calcCount;

}
