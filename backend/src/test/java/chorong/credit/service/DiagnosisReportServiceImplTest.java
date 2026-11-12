package chorong.credit.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;

import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.credit.dto.DiagnosisReportRequestDTO;
import chorong.credit.dto.DiagnosisReportResponseDTO;
import chorong.credit.entity.CreditBand;
import chorong.credit.entity.DiagnosisReport;
import chorong.credit.entity.ReportType;
import chorong.credit.repository.DiagnosisReportRepository;

/*
 * 진단 결과 저장 (CREDIT-02) 테스트
 * DB 대신 가짜 Repository (Mockito)를 씀
 */
class DiagnosisReportServiceImplTest {

	private static final Long MEMBER_ID = 1L;

	private DiagnosisReportRepository repository;
	private DiagnosisReportServiceImpl service;

	@BeforeEach
	void setUp() {
		repository = mock(DiagnosisReportRepository.class);
		service = new DiagnosisReportServiceImpl(repository);
	}

	@Test
	void 리포트가_없으면_새로_저장한다() {
		// Given
		when(repository.findByMemberId(MEMBER_ID)).thenReturn(Optional.empty());
		when(repository.save(any(DiagnosisReport.class))).thenAnswer(invocation -> invocation.getArgument(0));

		// When
		DiagnosisReportResponseDTO response = service.saveReport(MEMBER_ID, new DiagnosisReportRequestDTO(CreditBand.BAND3));

		// Then
		ArgumentCaptor<DiagnosisReport> captor = ArgumentCaptor.forClass(DiagnosisReport.class);
		verify(repository).save(captor.capture());
		assertEquals(MEMBER_ID, captor.getValue().getMemberId());
		assertEquals(ReportType.CREDIT, captor.getValue().getReportType());
		assertEquals(CreditBand.BAND3, response.getCreditBand());
	}

	@Test
	void 리포트가_있으면_새로_만들지_않고_구간을_덮어쓴다() {
		// Given
		DiagnosisReport existing = new DiagnosisReport(MEMBER_ID, CreditBand.BAND5);
		when(repository.findByMemberId(MEMBER_ID)).thenReturn(Optional.of(existing));

		// When
		DiagnosisReportResponseDTO response = service.saveReport(MEMBER_ID, new DiagnosisReportRequestDTO(CreditBand.BAND1));

		// Then
		verify(repository, never()).save(any());
		assertEquals(CreditBand.BAND1, existing.getCreditBand());
		assertEquals(CreditBand.BAND1, response.getCreditBand());
	}

	@Test
	void 동시에_처음_저장해_unique가_깨지면_409() {
		// Given
		when(repository.findByMemberId(MEMBER_ID)).thenReturn(Optional.empty());
		when(repository.save(any(DiagnosisReport.class))).thenThrow(new DataIntegrityViolationException("unique"));

		// When
		BusinessException e = assertThrows(BusinessException.class,
				() -> service.saveReport(MEMBER_ID, new DiagnosisReportRequestDTO(CreditBand.BAND2)));

		// Then
		assertEquals(ErrorCode.CONFLICT, e.getErrorCode());
	}

	@Test
	void 리포트가_있으면_조회된다() {
		// Given
		when(repository.findByMemberId(MEMBER_ID)).thenReturn(Optional.of(new DiagnosisReport(MEMBER_ID, CreditBand.BAND4)));

		// When
		Optional<DiagnosisReportResponseDTO> response = service.getReport(MEMBER_ID);

		// Then
		assertEquals(CreditBand.BAND4, response.get().getCreditBand());
	}

	@Test
	void 리포트가_없으면_빈_값을_돌려준다() {
		// Given
		when(repository.findByMemberId(MEMBER_ID)).thenReturn(Optional.empty());

		// When
		Optional<DiagnosisReportResponseDTO> response = service.getReport(MEMBER_ID);

		// Then
		assertTrue(response.isEmpty());
	}

	@Test
	void 삭제는_내_회원_번호로_찾은_리포트만_지운다() {
		// Given
		DiagnosisReport mine = new DiagnosisReport(MEMBER_ID, CreditBand.BAND2);
		when(repository.findByMemberId(MEMBER_ID)).thenReturn(Optional.of(mine));

		// When
		service.discardReport(MEMBER_ID);

		// Then
		verify(repository).delete(mine);
	}

	@Test
	void 리포트가_없어도_삭제는_오류_없이_끝난다() {
		// Given
		when(repository.findByMemberId(MEMBER_ID)).thenReturn(Optional.empty());

		// When
		service.discardReport(MEMBER_ID);

		// Then
		verify(repository, never()).delete(any());
	}
}
