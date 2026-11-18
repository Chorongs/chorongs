import { isSafeReturnPath } from '../utils/validate'
import api from './axiosInstance'

// 소셜 로그인, 가입 완료, 로그아웃, 내 정보 (API-16~18, 50). 본문 { success, data }의 data만 꺼내 돌려준다.

// 소셜 로그인 뒤 돌아올 사이트 안 주소를 잠깐 두는 sessionStorage 이름 (API-18, E12). 로그인 정보는 두지 않음 (E14)
export const RETURN_PATH_KEY = 'chorong-return-path'

// API-18 소셜 로그인 시작: axios가 아니라 서버 주소로 화면째 이동 (provider: kakao, naver)
// returnPath: 로그인 뒤 돌아올 주소. 사이트 안 주소만 기억하고, 없거나 이상하면 지움 (→ 로그인 뒤 /my)
export function getLoginUrl(provider, returnPath = null) {
  if (isSafeReturnPath(returnPath)) sessionStorage.setItem(RETURN_PATH_KEY, returnPath)
  else sessionStorage.removeItem(RETURN_PATH_KEY)
  window.location.href = `${import.meta.env.VITE_API_BASE_URL}/oauth2/authorization/${provider}`
}

// API-17 내 정보 확인 (401이면 비회원)
export async function getMe() {
  const response = await api.get('/api/auth/me')
  return response.data.data
}

// API-50 가입 완료: { termsAgreed, birthYear, birthDay } (needBirth가 false면 생년월일은 안 보냄)
export async function postSignup(body) {
  const response = await api.post('/api/auth/signup', body)
  return response.data.data
}

// API-16 로그아웃 (204, 본문 없음)
export async function postLogout() {
  await api.post('/api/auth/logout')
}
