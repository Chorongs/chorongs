package chorong.help.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * HELP-07 용어 추가 요청 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TermAddRequestDTO {
    @NotBlank
    @Size(max = 30)
    private String word;
}
