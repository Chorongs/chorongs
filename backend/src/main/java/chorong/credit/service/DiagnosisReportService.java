package chorong.credit.service;

import java.util.Optional;

import chorong.credit.dto.DiagnosisReportRequestDTO;
import chorong.credit.dto.DiagnosisReportResponseDTO;

/*
 * 진단 리포트 (CREDIT-02): 구간 + 시각만 회원당 1개 저장
 * memberId는 Controller가 세션에서 꺼내 넘김 (B3)
 */
public interface DiagnosisReportService {

	/** 내 리포트 조회, 없으면 빈 값 (Controller가 204) */
	Optional<DiagnosisReportResponseDTO> getReport(Long memberId);

	/** 구간 저장, 이미 있으면 덮어씀 */
	DiagnosisReportResponseDTO saveReport(Long memberId, DiagnosisReportRequestDTO request);

	/** 내 리포트 삭제 (없어도 성공). delete로 시작하는 이름은 SpotBugs가 변경 가능 객체로 봐서 discard 사용 */
	void discardReport(Long memberId);
}
