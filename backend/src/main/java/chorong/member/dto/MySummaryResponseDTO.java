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
    private long wishCount; //찜 갯수
    private long recentViewCount; //최근에 본 상품 갯수
    private long compareCount; // 비교 이력 갯수
//    private long calcCount;  //대출 이자 계산 저장 갯수
//    private long dsrCount; //dsr 계산 저장 갯수
//    private long changeCount; //갈아타기 계산 저장 갯수
//    private long homeLimit; //내집마련 대출 한도 게산 저장 갯수
//    private long reversCalc; //상환능력기반 대출 계산 저장 갯수



}
