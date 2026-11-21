import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import Icon from '../../components/ui/Icon'
import useAdminStore from '../../store/useAdminStore'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError } from '../../styles/common'
import { formatTime } from '../../utils/format'
import { isBlank } from '../../utils/validate'

// AD-01 관리자 로그인 (/admin/login, SCR-21): 관리자 이메일 → [토큰 받기] (API-29 ①) → 메일로 받은 토큰 → [로그인] (API-29 ②) → /admin
// 열 때 세션 확인 (API-30) → 이미 인증이면 /admin
// 토큰 칸은 204일 때만 열림 (status tokenSent), 그때 이메일 칸은 잠기고 버튼 하나가 [로그인]으로 바뀜
//   '다른 이메일로' → 처음 단계로 / '토큰 다시 받기' → 60초 안이면 남은 초 안내
// [토큰 받기] 60초 잠금은 204, 429 응답 뒤에만 (404, 403, 423은 메일을 안 보냈으므로 잠그지 않음)
// 응답별 안내 (API-29): 404 등록 안 됨 / 403 승인 대기 / 423 잠김 / 429 너무 잦음 / 로그인 400은 서버 문구 ('토큰이 맞지 않아요', '토큰을 다시 받아 주세요')
// 토큰 원문은 화면 상태(useState)에만 (E14) / 회원 로그인과 별개, 관리자로 로그인하면 같은 브라우저의 회원 로그인은 풀림 (한 번에 한 역할)
const COOLDOWN_SECONDS = 60

const TOKEN_ERROR_TEXT = {
  404: '등록되지 않은 메일이에요. 다시 확인해 주세요',
  403: '승인 대기 중인 메일이에요. 승인되면 메일로 알려 드려요',
  423: '5번 틀려서 잠겼어요. 30분 뒤 다시 시도하세요',
  429: '잠시 후 다시 시도해 주세요',
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 440px;
  margin: 8px auto 0;
`

const Head = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
  text-align: center;
`

const Mark = styled.span`
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: var(--r-lg);
  background: var(--ink);
  color: var(--paper);
`

const Tagline = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-base);
  font-weight: 700;
`

const Title = styled.h1`
  font-size: var(--fs-h2);
  font-weight: 800;
`

const Guide = styled.p`
  color: var(--cocoa);
`

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
  input {
    height: 52px;
    padding: 0 14px;
    border: 1px solid var(--line-2);
    border-radius: var(--r-sm);
    background: var(--paper);
    color: var(--ink);
    font-size: var(--fs-lg);
    font-weight: 600;
    transition: border-color var(--t-fast), box-shadow var(--t-fast);
    &:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px var(--brand-soft);
      outline: none;
    }
    &:read-only {
      background: var(--mist);
      color: var(--ink-2);
    }
    @media (max-width: 899px) {
      height: 48px;
    }
  }
  /* 토큰 칸: 숫자 글꼴, 자간 살짝 */
  input[inputmode='numeric'] {
    font-family: var(--f-num);
    font-size: var(--fs-xl);
    font-weight: 700;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
  }
`

const Notice = styled.p.attrs({ role: 'status' })`
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--brand-soft);
  color: var(--ink-2);
  font-size: var(--fs-md);
  text-align: center;
  &:empty {
    display: none;
  }
`

const Submit = styled(Button)`
  width: 100%;
`

const Sub = styled.div`
  display: flex;
  justify-content: center;
  gap: 16px;
`

const LinkButton = styled.button`
  color: var(--brand-text);
  font-size: var(--fs-sm);
  font-weight: 700;
  &:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`

const Note = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.65;
  text-align: center;
`

const JoinLink = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
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
  const showToast = useUiStore((state) => state.showToast)
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // [토큰 받기] 뒤 남은 잠금 초 (0이면 열림)
  const [cooldown, setCooldown] = useState(0)
  const [isPending, setIsPending] = useState(false)

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

  const isTokenSent = status === 'tokenSent'

  const handleRequestToken = async () => {
    if (isBlank(email)) {
      setError('이메일을 입력해 주세요')
      return
    }
    if (cooldown > 0) {
      setError(`토큰은 60초에 한 번 받을 수 있어요. ${cooldown}초 뒤에 다시 받아 주세요`)
      return
    }
    setError('')
    setNotice('')
    setIsPending(true)
    try {
      await requestToken(email.trim())
      setToken('')
      setNotice('토큰을 메일로 보냈어요. 메일함을 확인해 주세요')
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      const code = err.response?.status
      if (code === 429) setCooldown(COOLDOWN_SECONDS)
      if (code === 400) setError(err.response.data?.message ?? '이메일 형식을 확인해 주세요')
      else setError(TOKEN_ERROR_TEXT[code] ?? '토큰을 요청하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  const handleSignIn = async () => {
    if (isBlank(token)) {
      setError('메일로 받은 토큰을 입력해 주세요')
      return
    }
    setError('')
    setIsPending(true)
    try {
      await signIn(email.trim(), token.trim())
      const { admin, expiresAt } = useAdminStore.getState()
      showToast(`${admin?.adminName ?? '관리자'}(으)로 로그인했어요. ${formatTime(expiresAt)}까지 쓸 수 있어요`)
      navigate('/admin', { replace: true })
    } catch (err) {
      const code = err.response?.status
      if (code === 400) setError(err.response.data?.message ?? '토큰이 맞지 않아요')
      else if (TOKEN_ERROR_TEXT[code]) setError(TOKEN_ERROR_TEXT[code])
      else if (err.response) setError('토큰이 맞지 않아요')
      else setError('로그인하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isTokenSent) handleSignIn()
    else handleRequestToken()
  }

  // 처음 단계로: 토큰 칸 닫고 다른 이메일 입력
  const handleBack = () => {
    useAdminStore.setState({ status: 'guest' })
    setToken('')
    setError('')
    setNotice('')
  }

  return (
    <Wrap>
      <Head>
        <Mark aria-hidden="true">
          <Icon name="shield" size={30} />
        </Mark>
        <Tagline>캐링 관리자</Tagline>
        <Title>관리자 로그인</Title>
        <Guide>승인받은 관리자 이메일로 받은 토큰으로 로그인하세요.</Guide>
      </Head>
      <Notice>{notice}</Notice>
      <Form onSubmit={handleSubmit} noValidate>
        <Field>
          관리자 이메일
          <input
            type="email"
            value={email}
            readOnly={isTokenSent}
            autoComplete="email"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="관리자 이메일"
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        {isTokenSent && (
          <Field>
            메일로 받은 토큰
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={token}
              maxLength={6}
              placeholder="토큰 6자리"
              onChange={(event) => setToken(event.target.value)}
            />
          </Field>
        )}
        <InlineError>{error}</InlineError>
        <Submit type="submit" disabled={isPending}>
          {isTokenSent ? '로그인' : '토큰 받기'}
        </Submit>
        {isTokenSent && (
          <Sub>
            <LinkButton type="button" onClick={handleBack}>
              다른 이메일로
            </LinkButton>
            <LinkButton type="button" onClick={handleRequestToken} disabled={isPending}>
              토큰 다시 받기
            </LinkButton>
          </Sub>
        )}
      </Form>
      <Note>
        로그인하면 2시간 동안 쓸 수 있고, 활동해도 늘어나지 않아요.
        <br />
        토큰을 5번 틀리면 30분 동안 잠겨요.
        <br />
        토큰은 60초에 한 번 받을 수 있어요.
      </Note>
      <JoinLink>
        아직 관리자가 아닌가요?
        <br />
        <Link to="/admin/join">관리자 가입 신청</Link>
      </JoinLink>
    </Wrap>
  )
}

export default AdminLoginPage
