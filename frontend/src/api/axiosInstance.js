import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // 로그인 세션 쿠키를 서버 요청에 같이 보냄 (E14)
})

// 로그인 풀림(401) 공통 처리 (E4)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? ''

      if (url.startsWith('/api/admin/')) {
        // TODO(ST-06, CHORONG-55): 서버 문구 안내 + /admin/login 이동
      } else if (url !== '/api/auth/me') {
        // TODO(ST-01, CM-17, CHORONG-43): 화면 상태 guest로 + 로그인 안내 창 '로그인이 풀렸어요. 다시 로그인해 주세요' (입력 중인 값은 지우지 않음)
      }
    }
    return Promise.reject(error)
  },
)

export default api
