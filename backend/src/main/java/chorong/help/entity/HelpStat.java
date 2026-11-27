package chorong.help.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class HelpStat {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long statId;
    @NotNull
    @Enumerated(EnumType.STRING)
    private HelpType targetType;
    @NotNull
    private String targetKey;
    @NotNull
    private Long openCount;
    @NotNull
    private Long helpfulCount;
    @NotNull
    private Long unhelpfulCount;

    public void requestHelpfulCount(int count, boolean cancel) {
        if(!cancel) {
            this.helpfulCount+=count;
        }else {
            if(this.helpfulCount <= 0 ) {
                this.helpfulCount = 0L;
            }else {
                this.helpfulCount-=count;
            }

        }
    }

    public void requestUnhelpfulCount(int count, boolean cancel) {
        if(!cancel) {

            this.unhelpfulCount+=count;
        }else {
            if(this.unhelpfulCount <= 0) {
                this.unhelpfulCount = 0L;
            }else {
                this.unhelpfulCount-=count;
            }

        }
    }
}
