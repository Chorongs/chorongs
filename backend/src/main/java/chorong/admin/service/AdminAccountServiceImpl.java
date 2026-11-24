package chorong.admin.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import chorong.admin.dto.AdminRemoveRequestDTO;
import chorong.admin.dto.AdminResponseDTO;
import chorong.admin.dto.AdminRoleRequestDTO;
import chorong.admin.entity.Admin;
import chorong.admin.entity.AdminRole;
import chorong.admin.entity.AdminStatus;
import chorong.admin.repository.AdminRepository;
import chorong.admin.repository.AdminTokenRepository;
import chorong.common.dto.LoginAdminDTO;
import chorong.common.exception.BusinessException;
import chorong.common.exception.ErrorCode;
import chorong.common.util.AdminUtil;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AdminAccountServiceImpl implements AdminAccountService {

	// 문구 (관리자 상세 기획 4-11 문구 16, 18)
	static final String MSG_LAST_APPROVER = "다른 승인권자를 먼저 지정해 주세요";
	static final String MSG_ALREADY_HANDLED = "다른 승인권자가 먼저 처리함";

	private final AdminRepository adminRepository;
	private final AdminTokenRepository adminTokenRepository;
	private final AdminMailService adminMailService;

	@Override
	@Transactional(readOnly = true)
	public List<AdminResponseDTO> getAdmins(AdminStatus status) {
		if (status == AdminStatus.REMOVED) {	// 탈퇴한 관리자는 목록에 안 보임
			throw new BusinessException(ErrorCode.INVALID_INPUT);
		}
		List<AdminStatus> statuses = status == null ? List.of(AdminStatus.PENDING, AdminStatus.ACTIVE) : List.of(status);
		List<Admin> admins = adminRepository.findByAdminStatusInOrderByAdminIdAsc(statuses);

		// 승인한 사람 이름 (한 번에 조회, 탈퇴했으면 이름이 비어 null)
		List<Long> approverIds = admins.stream().map(Admin::getApprovedBy).filter(Objects::nonNull).distinct().toList();
		Map<Long, Admin> approvers = adminRepository.findAllById(approverIds).stream()
				.collect(Collectors.toMap(Admin::getAdminId, a -> a));
		return admins.stream()
				.map(a -> {
					Admin approver = a.getApprovedBy() == null ? null : approvers.get(a.getApprovedBy());
					return AdminResponseDTO.from(a, approver == null ? null : approver.getAdminName(), null);
				})
				.toList();
	}

	@Override
	@Transactional
	public void approveAdmin(Long approverId, Long adminId, AdminRoleRequestDTO request) {
		adminRepository.lockTable();	// 두 승인권자가 동시에 눌러도 한 명만 통과 (뒤 사람은 아래에서 409, B9)
		Admin admin = adminRepository.findById(adminId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
		if (admin.getAdminStatus() != AdminStatus.PENDING) {	// 다른 승인권자가 먼저 승인함 (B9)
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_HANDLED);
		}
		admin.approve(request.getRole(), approverId, LocalDateTime.now());
		adminMailService.sendApproved(admin.getAdminEmail(), request.getRole());	// 메일 실패 500이면 승인도 되돌림
	}

	@Override
	@Transactional
	public void changeRole(Long adminId, AdminRoleRequestDTO request) {
		adminRepository.lockTable();	// 승인권자 수 확인 + 변경을 한 번에 (동시에 서로 내리기 대비)
		Admin admin = findActiveAdmin(adminId);
		if (request.getRole() == AdminRole.MANAGER) {
			checkNotLastApprover(admin);
		}
		admin.changeRole(request.getRole());
	}

	@Override
	@Transactional
	public void unlockAdmin(Long adminId) {
		findActiveAdmin(adminId).unlock();
	}

	@Override
	@Transactional
	public void rejectAdmin(Long adminId) {
		adminRepository.lockTable();	// 승인과 동시에 눌러도 상태를 확인한 뒤 처리 (B9)
		Admin admin = adminRepository.findById(adminId)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));	// 이미 거절돼 지워진 신청도 404
		if (admin.getAdminStatus() != AdminStatus.PENDING) {	// 다른 승인권자가 먼저 승인함
			throw new BusinessException(ErrorCode.CONFLICT, MSG_ALREADY_HANDLED);
		}
		adminRepository.delete(admin);
	}

	@Override
	@Transactional
	public void removeAdmin(Long adminId) {
		adminRepository.lockTable();	// 마지막 승인권자 확인 + 해제를 한 번에 (B16)
		withdrawAdmin(findActiveAdmin(adminId));	// 해제된 사람은 다음 요청에서 401 (AdminInterceptor)
	}

	@Override
	@Transactional(readOnly = true)
	public AdminResponseDTO getMe(LoginAdminDTO loginAdmin) {
		Admin admin = findActiveAdmin(loginAdmin.getAdminId());
		return AdminResponseDTO.from(admin, null, loginAdmin.getLoginAt().plusHours(AdminUtil.LOGIN_HOURS));
	}

	@Override
	@Transactional
	public void withdraw(HttpSession session, AdminRemoveRequestDTO request) {
		adminRepository.lockTable();	// 마지막 승인권자 확인 + 탈퇴를 한 번에 (B16)
		Admin admin = findActiveAdmin(AdminUtil.getAdminId(session));
		if (!Objects.equals(admin.getAdminEmail(), AdminUtil.normalizeEmail(request.getEmail()))) {
			throw new BusinessException(ErrorCode.INVALID_INPUT);	// 확인용 이메일이 내 이메일과 다름
		}
		withdrawAdmin(admin);
		session.invalidate();
	}

	// 탈퇴, 해제 공통 (부르는 쪽이 먼저 admin 테이블 잠금): 마지막 정상 승인권자면 409 → REMOVED + 시각, 이메일과 이름 비움, 안 쓴 토큰 무효 (B16)
	private void withdrawAdmin(Admin admin) {
		checkNotLastApprover(admin);
		adminTokenRepository.expireUnusedTokens(admin.getAdminId());
		admin.withdraw(LocalDateTime.now());
	}

	// 대상이 정상 승인권자 중 마지막 1명이면 409
	private void checkNotLastApprover(Admin admin) {
		if (admin.getAdminRole() == AdminRole.APPROVER
				&& adminRepository.countByAdminStatusAndAdminRole(AdminStatus.ACTIVE, AdminRole.APPROVER) <= 1) {
			throw new BusinessException(ErrorCode.CONFLICT, MSG_LAST_APPROVER);
		}
	}

	// 정상 관리자만 (승인 대기, 탈퇴, 없는 번호는 같은 404)
	private Admin findActiveAdmin(Long adminId) {
		return adminRepository.findById(adminId)
				.filter(a -> a.getAdminStatus() == AdminStatus.ACTIVE)
				.orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
	}
}
