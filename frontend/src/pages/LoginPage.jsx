import { useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import * as authApi from '../api/authApi'
import kakaoSymbol from '../assets/images/kakao_symbol.svg'
import naverSymbol from '../assets/images/naver_symbol.png'
import useAdminStore from '../store/useAdminStore'
import useAuthStore from '../store/useAuthStore'
import useUiStore from '../store/useUiStore'
import AuthLayout from '../components/layout/AuthLayout'
import { Button } from '../styles/common'
import { ADMIN_SESSION_TEXT, ALREADY_LOGGED_IN_TEXT, LOGIN_OFFLINE_TEXT, checkSocialLogin } from '../utils/requireLogin'

// AU-01 로그인 화면 (/login): 소셜 로그인 시작. 자체 회원가입, 비밀번호 없음
// 이미 로그인 → /my / 버튼 → API-18 (카카오, 네이버 로그인 화면으로 이동)
// 주소의 error 값(API-19가 붙임)으로 안내 한 줄을 바꿈. 정해진 값이 아니면 기본 안내
// 소셜 버튼: 카카오 로그인 디자인 가이드의 문구('카카오 로그인' 또는 '로그인')와 받은 네이버 공식 리소스 문구('네이버 로그인')를 따름
//   심볼은 공식 파일 그대로(모양, 비율, 색 변경 금지), 글자가 있으니 alt=""(꾸밈 그림)
const ERROR_TEXT = {
  ADMIN_LOGGED_IN: ADMIN_SESSION_TEXT,
  CANCELLED: '로그인을 취소했어요',
  FAILED: '로그인에 실패했어요.\n다시 시도해 주세요',
}

// 소셜 버튼 두 개 (버튼 사이 8px)
const Social = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

function LoginPage() {
  const status = useAuthStore((state) => state.status)
  const showToast = useUiStore((state) => state.showToast)
  const [searchParams] = useSearchParams()
  // MY에서 [로그인]으로 왔으면 보던 /my 주소 (기획서 3-7, 7-1 9번). 없으면 null → 로그인 뒤 /my
  const returnPath = useLocation().state?.returnPath ?? null
  // 로그인 여부를 다시 확인하는 동안 버튼 잠금 (E5)
  const [isChecking, setIsChecking] = useState(false)
  // 관리자로 로그인 중 (SCR-16 비고: 회원 로그인 막음): 화면 상태가 authed면 바로, 아니면 버튼을 누를 때 서버(API-30)에 확인
  const isAdminAuthed = useAdminStore((state) => state.status) === 'authed'
  const [isAdminBlocked, setIsAdminBlocked] = useState(false)
  // 관리자 세션이 있는 것을 알면 버튼을 잠가 서버에 다시 묻지 않음 (안내 한 줄은 관리자 안내)
  const isAdminSession = isAdminAuthed || isAdminBlocked
  const errorText = isAdminSession ? ERROR_TEXT.ADMIN_LOGGED_IN : ERROR_TEXT[searchParams.get('error')]

  // 확인하는 동안(checking)에도 로그인 버튼을 보여 줌 (서버 응답이 늦어도 화면이 멈춰 보이지 않게)
  // 누르는 순간 아래 handleLogin이 서버에 다시 확인하므로 이미 로그인 중이면 소셜 로그인으로 보내지 않음
  if (status === 'member') return <Navigate to="/my" replace />

  // 돌아올 주소: MY에서 넘겨받은 주소(사이트 안 주소만, getLoginUrl이 검사 E12), 없으면 로그인 뒤 /my
  // 보내기 전 확인은 checkSocialLogin: 이미 로그인 중이면 알림 (로그인 상태를 다시 채우면 위의 Navigate가 /my로 보냄)
  //   / 서버 응답 없음 → 다시 시도 알림 / 관리자 세션 → 안내 한 줄을 관리자 안내로
  const handleLogin = async (provider) => {
    setIsChecking(true)
    const check = await checkSocialLogin()
    setIsChecking(false)
    if (check === 'offline') showToast(LOGIN_OFFLINE_TEXT)
    else if (check === 'member') showToast(ALREADY_LOGGED_IN_TEXT)
    else if (check === 'admin') setIsAdminBlocked(true)
    else authApi.getLoginUrl(provider, returnPath)
  }

  return (
    <AuthLayout
      mark="logo"
      title="로그인"
      description={errorText ?? '로그인 방법을 선택해 주세요'}
      isError={Boolean(errorText)}
    >
      <Social>
        <Button $variant="kakao" onClick={() => handleLogin('kakao')} disabled={isChecking || isAdminSession}>
          <img src={kakaoSymbol} alt="" />
          카카오 로그인
        </Button>
        <Button $variant="naver" onClick={() => handleLogin('naver')} disabled={isChecking || isAdminSession}>
          <img src={naverSymbol} alt="" />
          네이버 로그인
        </Button>
      </Social>
    </AuthLayout>
  )
}

export default LoginPage
