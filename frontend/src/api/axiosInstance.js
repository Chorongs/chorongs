import axios from 'axios'
import useAdminStore from '../store/useAdminStore'
import useAuthStore from '../store/useAuthStore'
import useMyStore from '../store/useMyStore'
import useUiStore from '../store/useUiStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // 로그인 세션 쿠키를 서버 요청에 같이 보냄 (E14)
})

// '준비 중': 아직 서버에 없는 API는 보내지 않고 바로 실패로 돌려줌
// 쓰는 쪽은 error.isPreparing이면 실패 문구 대신 PREPARING_TEXT를 보여 줌. API가 서버에 올라오면 그 줄만 지운다
export const PREPARING_TEXT = '아직 준비 중인 서비스예요'
// 지금은 비어 있음 (서버에 아직 없는 API가 생기면 주소 정규식을 한 줄씩 넣음)
const PREPARING_APIS = []

api.interceptors.request.use((config) => {
  const url = config.url ?? ''
  if (PREPARING_APIS.some((pattern) => pattern.test(url))) {
    const error = new Error(PREPARING_TEXT)
    error.isPreparing = true
    error.config = config
    return Promise.reject(error)
  }
  return config
})

// 로그인 풀림(401) 공통 처리 (E4)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? ''

      if (url.startsWith('/api/admin/')) {
        // 관리자 (AD-02, ST-06): 화면 상태 guest로 → RequireAdmin이 /admin/login으로 보냄 + 서버 문구 안내 (알림)
        //   (서버 문구: '2시간이 지나 자동으로 로그아웃했어요' / '관리자 권한이 없어졌어요' / 세션 없음 '로그인이 필요합니다.')
        // 로그인, 가입 흐름(/api/admin/auth*, /api/admin/join*)의 401은 아직 로그인 전이거나 토큰이 틀린 것이므로 부르는 쪽이 처리
        const isAuthFlow = /^\/api\/admin\/(auth|join)(\/|$)/.test(url)
        if (!isAuthFlow) {
          useAdminStore.setState({ admin: null, status: 'guest', expiresAt: null })
          useUiStore.getState().showToast(error.response.data?.message ?? '로그인이 풀렸어요. 다시 로그인해 주세요')
        }
      } else if (url !== '/api/auth/me') {
        // 회원 기능: 화면 상태 guest로, 찜 번호 비움 (회원 관리 기획서 3-5) + 로그인 안내 창 (입력 중인 값은 지우지 않음)
        // 앱 시작 확인(/api/auth/me)은 안내 안 함
        useAuthStore.setState({ user: null, status: 'guest' })
        useMyStore.setState({ likedIds: [] })
        useUiStore.getState().openLoginDialog('로그인이 풀렸어요.\n다시 로그인해 주세요')
      }
    }
    return Promise.reject(error)
  },
)

export default api
