import { useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { RETURN_PATH_KEY } from '../api/authApi'
import TermsAgreement from '../components/auth/TermsAgreement'
import { LOGIN_TYPE_LABEL } from '../constants/options'
import useAuthStore from '../store/useAuthStore'
import useUiStore from '../store/useUiStore'
import { isSafeReturnPath } from '../utils/validate'

// AU-02 소셜 로그인 처리, 가입 화면 (/oauth/callback): 서버(API-19)가 result를 붙여 보냄
// LOGIN: 앱 시작 때 부른 API-17 결과를 기다림 → 회원이면 돌아갈 주소 또는 /my + 알림
// SIGNUP: 가입 단계 (AU-03, needBirth=true면 생년월일 칸) → API-50 → 돌아갈 주소 또는 /my + 알림
// result 없이 직접 열면 API 호출 없이 /login
// result, needBirth는 화면 분기에만 씀 (로그인 여부는 API-17 서버 응답이 기준) / 로그인 정보 브라우저 저장 금지 (E14)
const Status = styled.p`
  padding: 36px 0;
  color: var(--cocoa);
  text-align: center;
`

// 기억해 둔 돌아갈 주소를 한 번만 꺼냄: 없으면 /my, 사이트 밖 주소면 / (E12, 회원 관리 기획서 3-3)
function takeReturnPath() {
  const path = sessionStorage.getItem(RETURN_PATH_KEY)
  sessionStorage.removeItem(RETURN_PATH_KEY)
  if (path === null) return '/my'
  return isSafeReturnPath(path) ? path : '/'
}

function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const result = searchParams.get('result')
  const needBirth = searchParams.get('needBirth') === 'true'
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const showToast = useUiStore((state) => state.showToast)
  const navigate = useNavigate()

  // LOGIN: 확인이 끝나면 이동 (회원이 아니면 로그인 실패로 안내)
  useEffect(() => {
    if (result !== 'LOGIN' || status === 'checking') return
    if (status === 'member') {
      showToast(`${LOGIN_TYPE_LABEL[user.loginType] ?? '소셜'} 계정으로 로그인했어요`)
      navigate(takeReturnPath(), { replace: true })
    } else {
      navigate('/login?error=FAILED', { replace: true })
    }
  }, [result, status, user, showToast, navigate])

  if (result === 'SIGNUP') {
    const handleDone = (member) => {
      useAuthStore.setState({ user: member, status: 'member' })
      showToast(`${member.memberNickname}님, 환영해요`)
      navigate(takeReturnPath(), { replace: true })
    }
    return <TermsAgreement needBirth={needBirth} onDone={handleDone} />
  }

  if (result !== 'LOGIN') return <Navigate to="/login" replace />

  return <Status role="status">로그인하는 중이에요</Status>
}

export default OAuthCallbackPage
