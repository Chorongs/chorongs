package chorong.help.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/*
 * HELP-05 질문 남기기 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class QuestionRequestDTO {

    @NotBlank
    private String content;
}
