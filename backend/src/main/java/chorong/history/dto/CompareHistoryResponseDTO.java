package chorong.history.dto;

import chorong.product.dto.ProductSummaryDTO;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/*
 * 비교 내역 응답 한 줄 (MEM-10): compareId, comparedAt, productA, productB (ProductSummaryDTO)
 * GET 응답 data는 items (최근 10개)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CompareHistoryResponseDTO {
    private Long compareId;
    @JsonFormat(shape=JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm", timezone = "Asia/Seoul")
    private LocalDateTime comparedAt;
    private ProductSummaryDTO productA;
    private ProductSummaryDTO productB;
}
