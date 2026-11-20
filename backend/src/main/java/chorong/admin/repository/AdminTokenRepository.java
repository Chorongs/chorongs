package chorong.admin.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import chorong.admin.entity.AdminToken;

/*
 * admin_token 테이블 Repository
 */
public interface AdminTokenRepository extends JpaRepository<AdminToken, Long> {

	// 그 관리자의 가장 최근 안 쓴 토큰 (ADMIN-03)
	Optional<AdminToken> findTopByAdminIdAndUsedYnOrderByTokenIdDesc(Long adminId, String usedYn);

	// 안 쓴 토큰 모두 무효 (새 토큰 요청 ADMIN-02, 탈퇴, 해제 ADMIN-09)
	@Modifying
	@Query("UPDATE AdminToken t SET t.usedYn = 'Y' WHERE t.adminId = :adminId AND t.usedYn = 'N'")
	int expireUnusedTokens(@Param("adminId") Long adminId);
}
