package chorong.admin.service;

import java.util.List;

import chorong.admin.dto.AdminRemoveRequestDTO;
import chorong.admin.dto.AdminResponseDTO;
import chorong.admin.dto.AdminRoleRequestDTO;
import chorong.admin.entity.AdminStatus;
import chorong.common.dto.LoginAdminDTO;
import jakarta.servlet.http.HttpSession;

/*
 * 승인, 거절, 역할, 잠금 풀기, 해제, 내 계정, 탈퇴 (ADMIN-08, 09) / 마지막 정상 승인권자 보호
 * 승인권자 확인은 AdminInterceptor (/api/admin/admins/**)
 */
public interface AdminAccountService {

	/** 관리자 목록: status 없으면 승인 대기 + 정상, 탈퇴는 안 보임 (ADMIN-08) */
	List<AdminResponseDTO> getAdmins(AdminStatus status);

	/** 가입 승인: 승인 대기만 (아니면 409) → 정상 + 역할 + 승인 안내 메일 (ADMIN-08) */
	void approveAdmin(Long approverId, Long adminId, AdminRoleRequestDTO request);

	/** 역할 바꾸기: 마지막 정상 승인권자를 관리자로 내리면 409 (ADMIN-08) */
	void changeRole(Long adminId, AdminRoleRequestDTO request);

	/** 잠금 풀기: 실패 0, 잠금 시각 비움 (ADMIN-08) */
	void unlockAdmin(Long adminId);

	/** 승인 대기면 거절 (행 삭제, 메일 없음), 정상이면 해제 (ADMIN-08, 09) */
	void removeAdmin(Long adminId);

	/** 내 계정 (ADMIN-09) */
	AdminResponseDTO getMe(LoginAdminDTO loginAdmin);

	/** 본인 탈퇴: 확인용 이메일이 내 이메일이어야 함 → 해제와 같은 처리 + 세션 무효화 (ADMIN-09) */
	void withdraw(HttpSession session, AdminRemoveRequestDTO request);
}
