package chorong.history.dto.recentView;

import chorong.product.dto.ProductSummaryDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/*
 * 최근 본 대출 응답 한 줄 (MEM-08): ProductSummaryDTO + 본 시각 (viewedAt)
 * GET 응답 data는 items (최근 10개)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RecentViewResponseDTO {
    private ProductSummaryDTO product;
    private LocalDateTime viewedAt;
}
