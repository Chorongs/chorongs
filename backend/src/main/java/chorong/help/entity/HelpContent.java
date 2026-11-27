package chorong.help.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class HelpContent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long helpId;
    @NotNull
    @Enumerated(EnumType.STRING)
    private HelpType helpType;
    @NotNull
    private Integer helpNo;
    private String category;
    private String keyword1;
    private String keyword2;
    private String keyword3;
    private String keyword4;
    private String keyword5;
    @NotNull
    private String title;
    @Lob
    @NotNull
    private String content;
    private String summary;
}
