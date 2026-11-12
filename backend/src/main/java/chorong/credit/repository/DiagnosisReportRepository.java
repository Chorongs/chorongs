package chorong.credit.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import chorong.credit.entity.DiagnosisReport;

/*
 * diagnosis_report 테이블 Repository
 * 회원 번호로만 찾음 (내 것만 조회, 삭제 - B3) / 삭제는 JpaRepository 기본 delete를 씀
 */
public interface DiagnosisReportRepository extends JpaRepository<DiagnosisReport, Long> {

	Optional<DiagnosisReport> findByMemberId(Long memberId);
}
