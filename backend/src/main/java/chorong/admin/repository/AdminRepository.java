package chorong.admin.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;

/*
 * admin 테이블 Repository (다른 기능도 이것을 가져다 씀)
 * findById 등 기본 메서드는 JpaRepository가 만들어 줌
 */
public interface AdminRepository extends JpaRepository<Admin, Long> {

	// 이메일로 관리자 찾기 (탈퇴, 해제한 관리자는 이메일이 비어 있어 안 찾아짐)
	Optional<Admin> findByAdminEmail(String adminEmail);

	// 상태별 인원 (정상 관리자 0명 = 첫 가입자 ADMIN-07, 승인 대기 개수 ADMIN-04)
	long countByAdminStatus(AdminStatus adminStatus);

	// 상태 + 역할 인원 (마지막 정상 승인권자 보호, ADMIN-08, 09)
	long countByAdminStatusAndAdminRole(AdminStatus adminStatus, AdminRole adminRole);

	// 관리자 목록 (승인 대기, 정상 / 탈퇴는 안 보임, ADMIN-08)
	List<Admin> findByAdminStatusInOrderByAdminIdAsc(Collection<AdminStatus> adminStatuses);

	// 신청한 지 오래된 승인 대기 (14일 정리, BAT-03)
	List<Admin> findByAdminStatusAndRequestedAtBefore(AdminStatus adminStatus, LocalDateTime time);

	// admin 테이블 쓰기 잠금 (트랜잭션 끝까지, 읽기는 안 막음): 첫 가입자 판단 + 저장, 마지막 승인권자 확인 + 변경,
	// 승인, 거절의 상태 확인 + 처리를 한 번에 (B9, B16)
	@Modifying
	@Query(value = "LOCK TABLE admin IN EXCLUSIVE MODE", nativeQuery = true)
	void lockTable();
}
