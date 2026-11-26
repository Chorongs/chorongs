package chorong.calculator.service;

import chorong.calculator.dto.DsrCalcRequestDTO;
import chorong.calculator.dto.DsrCalcResponseDTO;

public interface DsrCalcService {

	// DSR 계산 기록 저장 (CAL-06). 값 확인 후 계산 1행 + 대출 행들 저장, 회원당 10개 넘으면 가장 오래된 기록 삭제
	void saveDsrCalc(Long memberId, DsrCalcRequestDTO request);

	// 같은 기록을 이미 저장했는지 (POST /check, 읽기만). 계산기 화면이 [결과 저장] 버튼을 미리 잠글 때 씀
	boolean hasSavedDsrCalc(Long memberId, DsrCalcRequestDTO request);

	// 내 기록 목록 (최신순, 대출 목록 포함)
	DsrCalcResponseDTO getDsrCalcs(Long memberId);

	// 내 기록 1건 삭제 (대출 행 먼저). 없거나 남의 기록이면 404
	void deleteDsrCalc(Long memberId, Long dsrId);

	// 내 기록 전체 삭제 (대출 행 먼저)
	void deleteDsrCalcs(Long memberId);
}
