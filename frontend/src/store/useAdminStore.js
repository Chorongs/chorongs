import { create } from 'zustand'
import * as adminApi from '../api/adminApi'
import useAuthStore from './useAuthStore'

// ST-06 관리자 인증 (저장 안 함: 로그인은 서버 세션 쿠키, E14. 토큰 원문은 스토어에도 두지 않음)
// admin: AdminResponseDTO 그대로 (adminId, adminName, adminEmail, adminRole APPROVER 승인권자 / MANAGER 관리자)
// status: checking 확인 중 / guest 인증 안 됨 / tokenSent 토큰 메일 보냄 (로그인 화면) / authed 인증됨
// expiresAt: 만료 시각 (로그인 + 2시간 고정, 서버가 준 값 그대로)
// 역할은 메뉴 숨김용, 권한 확인은 서버 (AdminInterceptor)
// TODO(CHORONG-57 BE): AdminResponseDTO 필드 이름(adminName, adminRole, expiresAt 등)은 DTO 파일이 올라오면 맞춘다
const useAdminStore = create((set) => ({
  admin: null,
  status: 'checking',
  expiresAt: null,

  // API-30 세션 확인: 성공 → authed / 실패(401 등) → guest
  check: async () => {
    set({ status: 'checking' })
    try {
      const admin = await adminApi.getAdminSession()
      set({ admin, status: 'authed', expiresAt: admin?.expiresAt ?? null })
    } catch {
      set({ admin: null, status: 'guest', expiresAt: null })
    }
  },

  // API-29 ① 토큰 요청: 204일 때만 tokenSent (실패는 부르는 쪽이 응답 코드별로 안내)
  requestToken: async (email) => {
    await adminApi.postAdminToken(email)
    set({ status: 'tokenSent' })
  },

  // API-29 ② 토큰 로그인 → authed. 관리자로 로그인하면 같은 브라우저의 회원 로그인은 풀림 (한 번에 한 역할, AD-01 비고)
  signIn: async (email, token) => {
    const admin = await adminApi.postAdminLogin(email, token)
    set({ admin, status: 'authed', expiresAt: admin?.expiresAt ?? null })
    useAuthStore.setState({ user: null, status: 'guest' })
  },

  // API-30 DELETE 로그아웃. 서버가 실패해도 화면 쪽은 guest로
  signOut: async () => {
    try {
      await adminApi.deleteAdminSession()
    } catch {
      // 실패해도 아래에서 비움
    }
    set({ admin: null, status: 'guest', expiresAt: null })
  },
}))

export default useAdminStore
