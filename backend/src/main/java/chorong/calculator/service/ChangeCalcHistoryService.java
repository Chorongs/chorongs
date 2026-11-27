package chorong.calculator.service;

import chorong.calculator.dto.ChangeCalcHistoryRequestDTO;
import chorong.calculator.dto.ChangeCalcHistoryResponseDTO;

public interface ChangeCalcHistoryService {

	// 갈아타기 계산 기록 저장 (CAL-05). 값 확인 후 저장, 회원당 10개 넘으면 가장 오래된 기록 삭제
	void saveChangeCalc(Long memberId, ChangeCalcHistoryRequestDTO request);

	// 같은 기록을 이미 저장했는지 (POST /check, 읽기만). 계산기 화면이 [결과 저장] 버튼을 미리 잠글 때 씀
	boolean hasSavedChangeCalc(Long memberId, ChangeCalcHistoryRequestDTO request);

	// 내 기록 목록 (최신순)
	ChangeCalcHistoryResponseDTO getChangeCalcs(Long memberId);

	// 내 기록 1건 삭제. 없거나 남의 기록이면 404
	void deleteChangeCalc(Long memberId, Long changeId);

	// 내 기록 전체 삭제
	void deleteChangeCalcs(Long memberId);
}
