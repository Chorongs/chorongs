package chorong.credit.service;

import chorong.credit.dto.CreditCheckRequestDTO;
import chorong.credit.dto.CreditCheckResponseDTO;

/*
 * 신용 셀프 진단 (CREDIT-01): 문항 답 -> FastAPI 점수 -> 구간, 팁
 * 답, 점수는 저장하지 않고 로그에도 남기지 않음 (B8)
 */
public interface CreditService {

	/** 10문항 답으로 예상 점수, 구간, 문항별 상태와 팁을 만듦 */
	CreditCheckResponseDTO checkCredit(CreditCheckRequestDTO request);
}
