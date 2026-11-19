import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import useAdminStore from '../../store/useAdminStore'
import { Button, InlineError, Panel } from '../../styles/common'
import { isBlank } from '../../utils/validate'

// AD-01 관리자 로그인 (/admin/login, SCR-21): 관리자 이메일 → [토큰 받기] (API-29 ①) → 메일로 받은 토큰 → [로그인] (API-29 ②) → /admin
// 열 때 세션 확인 (API-30) → 이미 인증이면 /admin
// 토큰 칸은 204일 때만 열림 (status tokenSent) / [토큰 받기] 누른 뒤 60초 잠금 / 토큰 원문은 화면 상태(useState)에만 (E14)
// 응답별 안내 (API-29): 404 등록 안 됨 / 403 승인 대기 / 423 잠김 / 429 너무 잦음 / 그 밖은 다시 시도
// 회원 로그인과 별개. 관리자로 로그인하면 같은 브라우저의 회원 로그인은 풀림 (한 번에 한 역할)
const COOLDOWN_SECONDS = 60

const TOKEN_ERROR_TEXT = {
  404: '등록되지 않은 메일이에요. 다시 확인해 주세요',
  403: '승인 대기 중인 메일이에요. 승인되면 메일로 알려 드려요',
  423: '5번 틀려서 잠겼어요. 30분 뒤 다시 시도하세요',
  429: '잠시 후 다시 시도해 주세요',
}

const Wrap = styled(Panel)`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 440px;
  margin: 0 auto;
`

const Title = styled.h1`
  font-size: var(--fs-h1);
  font-weight: 800;
`

const Guide = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-md);
`

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-md);
  font-weight: 600;
  input {
    height: 52px;
    padding: 0 16px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-sm);
    background: var(--paper);
    color: var(--ink);
    font-size: var(--fs-lg);
    @media (max-width: 899px) {
      height: 48px;
    }
  }
`

const Notice = styled.p`
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--good-soft);
  color: var(--good);
  font-size: var(--fs-md);
  font-weight: 600;
`

const Links = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-md);
  text-align: center;
  a {
    color: var(--brand-text);
    font-weight: 700;
  }
`

function AdminLoginPage() {
  const status = useAdminStore((state) => state.status)
  const check = useAdminStore((state) => state.check)
  const requestToken = useAdminStore((state) => state.requestToken)
  const signIn = useAdminStore((state) => state.signIn)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // [토큰 받기] 뒤 남은 잠금 초 (0이면 열림)
  const [cooldown, setCooldown] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)

  // 열 때 세션 확인 (이미 인증이면 아래 Navigate가 /admin으로)
  useEffect(() => {
    if (useAdminStore.getState().status !== 'authed') check()
  }, [check])

  // 60초 잠금: 1초마다 줄임
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  if (status === 'authed') return <Navigate to="/admin" replace />

  const handleRequestToken = async () => {
    if (isBlank(email)) {
      setError('이메일을 입력해 주세요')
      return
    }
    setError('')
    setNotice('')
    setIsSending(true)
    try {
      await requestToken(email.trim())
      setToken('')
      setNotice('토큰을 보냈어요. 메일함을 확인해 주세요')
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      const code = err.response?.status
      // 메일을 못 보낸 응답(404, 403, 423)은 바로 고쳐 다시 요청할 수 있게 잠그지 않음. 429만 잠금
      if (code === 429) setCooldown(COOLDOWN_SECONDS)
      setError(TOKEN_ERROR_TEXT[code] ?? '토큰을 요청하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsSending(false)
    }
  }

  const handleSignIn = async () => {
    if (isBlank(token)) {
      setError('메일로 받은 토큰을 입력해 주세요')
      return
    }
    setError('')
    setIsSigningIn(true)
    try {
      await signIn(email.trim(), token.trim())
      navigate('/admin', { replace: true })
    } catch (err) {
      const code = err.response?.status
      if (code === 423) setError(TOKEN_ERROR_TEXT[423])
      else if (err.response) setError('토큰이 맞지 않아요')
      else setError('로그인하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsSigningIn(false)
    }
  }

  const isTokenSent = status === 'tokenSent'

  return (
    <Wrap>
      <Title>관리자 로그인</Title>
      <Guide>등록된 관리자 이메일로 로그인 토큰을 보내 드려요. 토큰은 2시간 동안 쓸 수 있고, 5번 틀리면 30분 잠겨요.</Guide>
      <Field>
        관리자 이메일
        <input
          type="email"
          value={email}
          autoComplete="email"
          placeholder="admin@example.com"
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      <Button $variant={isTokenSent ? 'outline' : 'primary'} onClick={handleRequestToken} disabled={isSending || cooldown > 0}>
        {cooldown > 0 ? `토큰 받기 (${cooldown}초 뒤 다시)` : isTokenSent ? '토큰 다시 받기' : '토큰 받기'}
      </Button>
      {notice && <Notice role="status">{notice}</Notice>}
      {isTokenSent && (
        <>
          <Field>
            메일로 받은 토큰
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={token}
              maxLength={6}
              onChange={(event) => setToken(event.target.value)}
            />
          </Field>
          <Button onClick={handleSignIn} disabled={isSigningIn}>
            로그인
          </Button>
        </>
      )}
      <InlineError>{error}</InlineError>
      <Links>
        관리자가 아직 아니라면 <Link to="/admin/join">관리자 가입 신청</Link>
      </Links>
    </Wrap>
  )
}

export default AdminLoginPage
