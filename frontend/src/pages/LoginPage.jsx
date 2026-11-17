import { Navigate, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import * as authApi from '../api/authApi'
import useAuthStore from '../store/useAuthStore'
import { Button, Panel } from '../styles/common'

// AU-01 로그인 화면 (/login): 소셜 로그인 시작. 자체 회원가입, 비밀번호 없음
// 이미 로그인 → /my / 버튼 → API-18 (카카오, 네이버 로그인 화면으로 이동)
// 주소의 error 값(API-19가 붙임)으로 안내 한 줄을 바꿈. 정해진 값이 아니면 기본 안내
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

const Status = styled.p`
  padding: 36px 0;
  color: var(--cocoa);
  text-align: center;
`

function LoginPage() {
  const status = useAuthStore((state) => state.status)
  const [searchParams] = useSearchParams()
  const errorText = ERROR_TEXT[searchParams.get('error')]

  if (status === 'checking') return <Status role="status">확인하는 중이에요</Status>
  if (status === 'member') return <Navigate to="/my" replace />

  // 이 화면에서 시작한 로그인은 돌아올 주소가 없음 → 로그인 뒤 /my
  const handleLogin = (provider) => authApi.getLoginUrl(provider)

  return (
    <Wrap>
      <Title>로그인</Title>
      <Guide $isError={Boolean(errorText)} role={errorText ? 'alert' : undefined}>
        {errorText ?? '로그인 방법을 선택하세요'}
      </Guide>
      <Button onClick={() => handleLogin('kakao')}>카카오로 계속하기</Button>
      <Button $variant="outline" onClick={() => handleLogin('naver')}>
        네이버로 계속하기
      </Button>
    </Wrap>
  )
}

export default LoginPage
