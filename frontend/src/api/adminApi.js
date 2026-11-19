import api from './axiosInstance'

// 관리자 API (API-29~36, 45~48). 본문 { success, data }의 data만 꺼내 돌려준다. 204는 본문 없음
// API-39, 49 (신고 상품)는 CHORONG-36에서, API-41 (질문 남기기 관리, AD-08)은 그 작업에서 추가한다
// TODO(CHORONG-57 BE): 받는 값 이름은 백엔드 DTO 파일(AdminResponseDTO, CatalogResponseDTO, ImportStatusResponseDTO,
//   PublishResponseDTO, HistoryResponseDTO, AdminJoinResponseDTO, AutoClosedResponseDTO)이 올라오면 쓰는 쪽(components/admin, store)에서 맞춘다

// API-29 ① 관리자 토큰 요청 (204, 토큰 메일 발송)
export async function postAdminToken(email) {
  await api.post('/api/admin/auth/token', { email })
}

// API-29 ② 토큰 로그인 → AdminResponseDTO (관리자 정보, 만료 시각)
export async function postAdminLogin(email, token) {
  const response = await api.post('/api/admin/auth', { email, token })
  return response.data.data
}

// API-30 관리자 세션 확인 → AdminResponseDTO (401이면 인증 안 됨)
export async function getAdminSession() {
  const response = await api.get('/api/admin/auth')
  return response.data.data
}

// API-30 관리자 세션 해제 (204)
export async function deleteAdminSession() {
  await api.delete('/api/admin/auth')
}

// API-31 게시 상품 현황 → CatalogResponseDTO
export async function getCatalog() {
  const response = await api.get('/api/admin/catalog')
  return response.data.data
}

// API-32 최신 상품 불러오기 시작: sources (KINFA, FSS 중 1~2개) → 작업 번호
export async function postImport(sources) {
  const response = await api.post('/api/admin/imports', { sources })
  return response.data.data
}

// API-33 불러오기 진행, 비교 결과 → ImportStatusResponseDTO
export async function getImport(importId) {
  const response = await api.get(`/api/admin/imports/${importId}`)
  return response.data.data
}

// API-34 사이트에 반영: { itemIds, baseVersion } → PublishResponseDTO (새 버전)
export async function postPublish(importId, body) {
  const response = await api.post(`/api/admin/imports/${importId}/publish`, body)
  return response.data.data
}

// API-35 반영 이력: { actionType (없으면 전체), page } → 이력 목록
export async function getVersions(params) {
  const response = await api.get('/api/admin/catalog/versions', { params })
  return response.data.data
}

// API-36 반영 되돌리기: { historyId, baseVersion } → PublishResponseDTO (새 버전)
export async function postRollback(body) {
  const response = await api.post('/api/admin/catalog/rollback', body)
  return response.data.data
}

// API-45 ① 가입 인증 토큰 요청: { email, name } (204)
export async function postJoinToken(body) {
  await api.post('/api/admin/join/token', body)
}

// API-45 ② 가입 신청: { email, name, token } → AdminJoinResponseDTO (승인 대기 / 첫 관리자는 바로 로그인)
export async function postJoin(body) {
  const response = await api.post('/api/admin/join', body)
  return response.data.data
}

// API-46 관리자 목록: status (PENDING 승인 대기, ACTIVE 정상) → AdminResponseDTO 목록
export async function getAdmins(status) {
  const response = await api.get('/api/admin/admins', { params: { status } })
  return response.data.data
}

// API-46 승인: role (APPROVER, MANAGER) (204)
export async function postAdminApprove(adminId, role) {
  await api.post(`/api/admin/admins/${adminId}/approve`, { role })
}

// API-46 역할 바꾸기 (204)
export async function patchAdminRole(adminId, role) {
  await api.patch(`/api/admin/admins/${adminId}/role`, { role })
}

// API-46 잠금 풀기 (204)
export async function postAdminUnlock(adminId) {
  await api.post(`/api/admin/admins/${adminId}/unlock`)
}

// API-46 거절(승인 대기) 또는 해제(정상) (204)
export async function deleteAdmin(adminId) {
  await api.delete(`/api/admin/admins/${adminId}`)
}

// API-47 내 계정 → AdminResponseDTO
export async function getAdminMe() {
  const response = await api.get('/api/admin/me')
  return response.data.data
}

// API-47 관리자 탈퇴: email (내 이메일, 확인용) (204)
export async function deleteAdminMe(email) {
  await api.delete('/api/admin/me', { data: { email } })
}

// API-48 자동 내림 목록: { filter (UNCHECKED, KEEP, REOPEN), page } → 목록
export async function getAutoClosed(params) {
  const response = await api.get('/api/admin/auto-closed', { params })
  return response.data.data
}

// API-48 자동 내림 처리: { productIds, action (KEEP 확인, REOPEN 다시 게시) } (204)
export async function patchAutoClosed(body) {
  await api.patch('/api/admin/auto-closed', body)
}
