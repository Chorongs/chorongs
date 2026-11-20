package chorong.history.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * 비교 내역 기록 요청 (MEM-10): productAId, productBId (A와 B는 서로 다른 상품)
 */
@Data
@NoArgsConstructor
public class CompareHistoryRequestDTO {
    @NotNull
    private Long productAId;
    @NotNull
    private Long productBId;

}
