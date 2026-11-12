package chorong.credit.service;

import java.util.Optional;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.credit.dto.DiagnosisReportRequestDTO;
import chorong.credit.dto.DiagnosisReportResponseDTO;
import chorong.credit.entity.DiagnosisReport;
import chorong.credit.repository.DiagnosisReportRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DiagnosisReportServiceImpl implements DiagnosisReportService {

	private final DiagnosisReportRepository diagnosisReportRepository;

	@Override
	@Transactional(readOnly = true)
	public Optional<DiagnosisReportResponseDTO> getReport(Long memberId) {
		return diagnosisReportRepository.findByMemberId(memberId).map(this::toResponse);
	}

	@Override
	@Transactional
	public DiagnosisReportResponseDTO saveReport(Long memberId, DiagnosisReportRequestDTO request) {
		Optional<DiagnosisReport> found = diagnosisReportRepository.findByMemberId(memberId);

		DiagnosisReport report;
		if (found.isPresent()) {
			report = found.get();
			report.overwrite(request.getCreditBand());
		} else {
			try {
				report = diagnosisReportRepository.save(new DiagnosisReport(memberId, request.getCreditBand()));
			} catch (DataIntegrityViolationException e) {
				// 같은 회원이 동시에 처음 저장 (unique(member_id) 위반, B9)
				throw new BusinessException(ErrorCode.CONFLICT);
			}
		}
		return toResponse(report);
	}

	@Override
	@Transactional
	public void discardReport(Long memberId) {
		diagnosisReportRepository.findByMemberId(memberId).ifPresent(diagnosisReportRepository::delete);
	}

	// 엔티티를 그대로 응답하지 않고 ResponseDTO로 바꿈
	private DiagnosisReportResponseDTO toResponse(DiagnosisReport report) {
		return new DiagnosisReportResponseDTO(report.getCreditBand(), report.getCreatedAt());
	}
}
