package chorong.wish.dto;

import chorong.product.dto.ProductSummaryDTO;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/*
 * 찜 목록 응답 (MEM-04): ProductSummaryDTO + 찜한 시각 (createdAt)
 * 응답 모양은 PageInfo (list, total, page, size)
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WishResponseDTO {
    private ProductSummaryDTO product;
    private LocalDateTime createdAt;
}
