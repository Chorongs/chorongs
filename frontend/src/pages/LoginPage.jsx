import { useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import * as authApi from '../api/authApi'
import kakaoSymbol from '../assets/images/kakao_symbol.svg'
import naverSymbol from '../assets/images/naver_symbol.png'
import useAuthStore from '../store/useAuthStore'
import useUiStore from '../store/useUiStore'
import { Button, Panel } from '../styles/common'

// AU-01 로그인 화면 (/login): 소셜 로그인 시작. 자체 회원가입, 비밀번호 없음
// 이미 로그인 → /my / 버튼 → API-18 (카카오, 네이버 로그인 화면으로 이동)
// 주소의 error 값(API-19가 붙임)으로 안내 한 줄을 바꿈. 정해진 값이 아니면 기본 안내
// 소셜 버튼: 카카오 로그인 디자인 가이드의 문구('카카오 로그인' 또는 '로그인')와 받은 네이버 공식 리소스 문구('네이버 로그인')를 따름
//   (명세서의 '카카오로 계속하기', '카카오로 로그인' 대신. 2026-11-17 사용자 결정 B, 문서_반영_목록)
//   심볼은 공식 파일 그대로(모양, 비율, 색 변경 금지), 글자가 있으니 alt=""(꾸밈 그림)
const ERROR_TEXT = {
  ADMIN_LOGGED_IN: '관리자로 로그인 중이에요.\n관리자에서 로그아웃한 뒤 로그인해 주세요',
  CANCELLED: '로그인을 취소했어요',
  FAILED: '로그인에 실패했어요.\n다시 시도해 주세요',
}

const Wrap = styled(Panel)`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 440px;
  margin: 0 auto;
  text-align: center;
`

const Title = styled.h1`
  font-size: var(--fs-h1);
  font-weight: 800;
`

// 안내와 해야 할 행동이 두 문장이면 두 줄로 나눔 (글 안의 \n, white-space: pre-line. 2026-11-17 사용자 요청)
const Guide = styled.p`
  white-space: pre-line;
  margin-bottom: 8px;
  color: ${({ $isError }) => ($isError ? 'var(--bad)' : 'var(--cocoa)')};
  font-weight: 600;
`

function LoginPage() {
  const status = useAuthStore((state) => state.status)
  const showToast = useUiStore((state) => state.showToast)
  const [searchParams] = useSearchParams()
  // MY에서 [로그인]으로 왔으면 보던 /my 주소 (기획서 3-7, 7-1 9번). 없으면 null → 로그인 뒤 /my
  const returnPath = useLocation().state?.returnPath ?? null
  // 로그인 여부를 다시 확인하는 동안 버튼 잠금 (E5)
  const [isChecking, setIsChecking] = useState(false)
  const errorText = ERROR_TEXT[searchParams.get('error')]

  // 확인하는 동안(checking)에도 로그인 버튼을 보여 줌 (서버 응답이 늦어도 화면이 멈춰 보이지 않게, 2026-11-17 사용자 결정)
  // 누르는 순간 아래 handleLogin이 서버에 다시 확인하므로 이미 로그인 중이면 소셜 로그인으로 보내지 않음
  if (status === 'member') return <Navigate to="/my" replace />

  // 돌아올 주소: MY에서 넘겨받은 주소(사이트 안 주소만, getLoginUrl이 검사 E12), 없으면 로그인 뒤 /my
  // 누르는 순간 서버(API-17)에 한 번 더 확인: 이미 로그인 중이면 소셜 로그인으로 보내지 않음
  //   → '이미 로그인되어 있어요' + 로그인 상태를 다시 채움 → 회원이면 위의 Navigate가 /my로 보냄 (다시 로그인, 다른 계정 가입 막음)
  // 서버 응답이 아예 없으면(서버 꺼짐, 네트워크 오류) 소셜 로그인으로 보내도 오류 화면만 뜨므로 보내지 않고 다시 시도 안내 (E3)
  const handleLogin = async (provider) => {
    setIsChecking(true)
    let me = null
    try {
      me = await authApi.getMe()
    } catch (error) {
      if (!error.response) {
        setIsChecking(false)
        showToast('로그인하지 못했어요. 다시 시도해 주세요')
        return
      }
      // 401 등 서버 응답이 있으면 비회원 → 아래에서 소셜 로그인으로 보냄
    }
    setIsChecking(false)
    if (me?.memberNickname) {
      showToast('이미 로그인되어 있어요')
      useAuthStore.getState().fetchMe()
      return
    }
    authApi.getLoginUrl(provider, returnPath)
  }

  return (
    <Wrap>
      <Title>로그인</Title>
      <Guide $isError={Boolean(errorText)} role={errorText ? 'alert' : undefined}>
        {errorText ?? '로그인 방법을 선택하세요'}
      </Guide>
      <Button $variant="kakao" onClick={() => handleLogin('kakao')} disabled={isChecking}>
        <img src={kakaoSymbol} alt="" />
        카카오 로그인
      </Button>
      <Button $variant="naver" onClick={() => handleLogin('naver')} disabled={isChecking}>
        <img src={naverSymbol} alt="" />
        네이버 로그인
      </Button>
    </Wrap>
  )
}

export default LoginPage
