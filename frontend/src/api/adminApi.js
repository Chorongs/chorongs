import api from './axiosInstance'

// 관리자 API (API-29~36, 45~48, 54). 본문 { success, data }의 data만 꺼내 돌려준다. 204는 본문 없음
// API-39, 49 (신고 상품)는 CHORONG-36에서, API-41 (질문 남기기 관리, AD-08)은 그 작업에서 추가한다
// 목록 응답은 PageInfo { list, total, page, size } (page는 1부터, 더 보기 = page * size < total)

// API-29 ① 관리자 토큰 요청 (204, 토큰 메일 발송)
export async function postAdminToken(email) {
  await api.post('/api/admin/auth/token', { email })
}

// API-29 ② 토큰 로그인 → AdminResponseDTO (관리자 정보, 만료 시각 expiresAt)
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

// API-31 게시 상품 현황 → CatalogResponseDTO (sourceCounts, currentVersion, lastUpdatedAt, 개수 3개)
export async function getCatalog() {
  const response = await api.get('/api/admin/catalog')
  return response.data.data
}

// API-55 최신 상품 확인: 출처 첫 쪽만 읽어 DB 적재 시각, 최신 여부 → ImportCheckResponseDTO (checkedAt, sources[], needsRefresh, pendingJob)
export async function getImportCheck() {
  const response = await api.get('/api/admin/imports/check')
  return response.data.data
}

// API-32 최신 상품 갱신 시작: sources (KINFA, FSS 중 1~2개) → ImportStatusResponseDTO (jobId만 채움). 이걸 눌렀을 때만 외부 API 전체 수집
export async function postImport(sources) {
  const response = await api.post('/api/admin/imports', { sources })
  return response.data.data
}

// API-33 불러오기 진행, 비교 결과 → ImportStatusResponseDTO (jobId, jobStatus, baseVersion, sourceResults, items)
export async function getImport(jobId) {
  const response = await api.get(`/api/admin/imports/${jobId}`)
  return response.data.data
}

// API-33 가장 최근 작업 (화면을 열 때 이어 보기, 작업이 없으면 404) → ImportStatusResponseDTO
export async function getLatestImport() {
  const response = await api.get('/api/admin/imports/latest')
  return response.data.data
}

// API-34 사이트에 반영: { itemIds, baseVersion (API-33 응답 값 그대로) } → PublishResponseDTO (version)
export async function postPublish(jobId, body) {
  const response = await api.post(`/api/admin/imports/${jobId}/publish`, body)
  return response.data.data
}

// API-35 반영 이력: { actionType (없으면 전체), page (1부터) } → PageInfo<HistoryResponseDTO> (한 쪽 12건)
export async function getVersions(params) {
  const response = await api.get('/api/admin/catalog/versions', { params })
  return response.data.data
}

// API-54 되돌리기 미리보기: historyId → RollbackPreviewResponseDTO (cancelCount, changedProductCount, unhiddenReportCount, baseVersion)
export async function getRollbackPreview(historyId) {
  const response = await api.get('/api/admin/catalog/rollback-preview', { params: { historyId } })
  return response.data.data
}

// API-36 반영 되돌리기: { historyId, baseVersion (미리보기 응답 값 그대로) } → PublishResponseDTO (version)
export async function postRollback(body) {
  const response = await api.post('/api/admin/catalog/rollback', body)
  return response.data.data
}

// API-45 ① 가입 인증 토큰 요청: { email, name } (204)
export async function postJoinToken(body) {
  await api.post('/api/admin/join/token', body)
}

// API-45 ② 가입 신청: { email, name, token } → AdminJoinResponseDTO (adminStatus: ACTIVE 첫 관리자 바로 로그인 / PENDING 승인 대기)
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

// API-46 가입 거절 (승인 대기만, 204 / 이미 승인됨 409 / 이미 지워짐 404)
export async function postAdminReject(adminId) {
  await api.post(`/api/admin/admins/${adminId}/reject`)
}

// API-46 해제 (정상 관리자만, 204)
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

// API-48 자동 내림 목록: { filter (UNCHECKED, KEEP, REOPEN), page (1부터) } → PageInfo<AutoClosedResponseDTO> (한 쪽 20건)
export async function getAutoClosed(params) {
  const response = await api.get('/api/admin/auto-closed', { params })
  return response.data.data
}

// API-48 자동 내림 처리: { productIds (최대 100개), action (KEEP 확인, REOPEN 다시 게시) } (204)
export async function patchAutoClosed(body) {
  await api.patch('/api/admin/auto-closed', body)
}
