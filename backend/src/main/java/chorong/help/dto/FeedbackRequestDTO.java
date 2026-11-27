package chorong.help.dto;

import chorong.help.entity.HelpType;
import chorong.help.entity.Vote;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// HELP-06 도움말 평가 DTO

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FeedbackRequestDTO {
    @NotNull
    private HelpType type;
    @NotNull
    private Long targetKey;
    @NotNull
    private Vote vote;

    private Boolean cancel;
}
