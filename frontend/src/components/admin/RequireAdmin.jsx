import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import styled from 'styled-components'
import useAdminStore from '../../store/useAdminStore'

// AD-02 관리자 길목: 관리자만 통과 (/admin, /admin/:section). 화면 숨김용, 권한 확인은 서버 (AdminInterceptor)
// 처음 들어오면 세션 확인 (API-30) → 인증 안 됨(guest, tokenSent) → /admin/login
// 관리자 API 401 → axiosInstance가 서버 문구 알림 + 스토어를 guest로 바꿈 → 여기서 /admin/login (E4)
// 403 (승인권자 전용 메뉴)은 그 메뉴(AdminPage, AdminAccounts)가 '승인권자만 쓸 수 있는 메뉴예요'로 안내
const Status = styled.p`
  padding: 36px 0;
  color: var(--cocoa);
  text-align: center;
`

function RequireAdmin({ children }) {
  const status = useAdminStore((state) => state.status)
  const check = useAdminStore((state) => state.check)

  // 들어올 때 한 번 확인 (이미 인증됐으면 다시 묻지 않음)
  useEffect(() => {
    if (useAdminStore.getState().status !== 'authed') check()
  }, [check])

  if (status === 'authed') return children
  if (status === 'checking') return <Status role="status">확인하는 중이에요</Status>
  return <Navigate to="/admin/login" replace />
}

export default RequireAdmin
