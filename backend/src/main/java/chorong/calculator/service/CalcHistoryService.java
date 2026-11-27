package chorong.calculator.service;

import chorong.calculator.dto.CalcHistoryRequestDTO;
import chorong.calculator.dto.CalcHistoryResponseDTO;

public interface CalcHistoryService {

	// 계산 기록 저장 (CAL-04). 기간 확인 후 저장, 회원당 10개 넘으면 가장 오래된 기록 삭제
	void saveCalc(Long memberId, CalcHistoryRequestDTO request);

	// 같은 기록을 이미 저장했는지 (POST /check, 읽기만). 계산기 화면이 [결과 저장] 버튼을 미리 잠글 때 씀
	boolean hasSavedCalc(Long memberId, CalcHistoryRequestDTO request);

	// 내 기록 목록 (최신순)
	CalcHistoryResponseDTO getCalcs(Long memberId);

	// 내 기록 1건 삭제. 없거나 남의 기록이면 404
	void deleteCalc(Long memberId, Long calcId);

	// 내 기록 전체 삭제
	void deleteCalcs(Long memberId);
}
