import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import useAdminStore from '../../store/useAdminStore'
import { Button, InlineError, Panel } from '../../styles/common'
import { isBlank, isValidAdminName } from '../../utils/validate'

// AD-12 관리자 가입 (/admin/join, SCR-24): 이메일, 이름 (2~20자) → [인증 토큰 받기] (API-45 ①, 204일 때만 토큰 칸 열림, 60초 잠금)
//   → 인증 토큰 6자리 → [가입 신청] (API-45 ②) → 관리자 0명이면 바로 /admin, 아니면 '신청을 받았어요. 승인되면 메일로 알려 드려요'
// 409 → 서버 문구 ('이미 등록된 메일이에요. 로그인해 주세요' / '이미 신청한 메일이에요. 승인되면 메일로 알려 드려요'), 토큰 칸 안 열림
// 토큰 10분 지남, 5번 틀림 → 서버 문구, 없으면 '인증 토큰을 다시 받아 주세요' / 429 → '잠시 후 다시'
// 토큰 원문은 화면 상태(useState)에만 (E14) / 누르는 중 잠금 (E5) / 일반 화면에 링크 없음 (관리자 로그인 화면에서만 이동)
// TODO(CHORONG-57 BE): 가입 신청 결과(AdminJoinResponseDTO)에서 '첫 관리자(바로 로그인)'를 구분하는 필드 이름을 맞춘다 (지금은 adminStatus === 'ACTIVE')
const COOLDOWN_SECONDS = 60
const NAME_ERROR = '이름은 2~20자로 입력해 주세요'

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

const Hint = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 400;
`

const Notice = styled.p`
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--good-soft);
  color: var(--good);
  font-size: var(--fs-md);
  font-weight: 600;
`

const Done = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--paper);
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

function AdminJoinPage() {
  const navigate = useNavigate()
  const check = useAdminStore((state) => state.check)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  // 단계: input 입력 / tokenSent 토큰 칸 열림 / done 신청 완료 안내
  const [step, setStep] = useState('input')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isJoining, setIsJoining] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const nameError = name !== '' && !isValidAdminName(name) ? NAME_ERROR : ''

  const handleRequestToken = async () => {
    if (isBlank(email)) {
      setError('이메일을 입력해 주세요')
      return
    }
    if (!isValidAdminName(name)) {
      setError(NAME_ERROR)
      return
    }
    setError('')
    setNotice('')
    setIsSending(true)
    try {
      await adminApi.postJoinToken({ email: email.trim(), name: name.trim() })
      setToken('')
      setStep('tokenSent')
      setNotice('인증 토큰을 보냈어요. 메일함을 확인해 주세요 (10분 안에 입력)')
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      const code = err.response?.status
      if (code === 409) setError(err.response.data?.message ?? '이미 등록된 메일이에요. 로그인해 주세요')
      else if (code === 429) {
        setError('잠시 후 다시 시도해 주세요')
        setCooldown(COOLDOWN_SECONDS)
      } else if (code === 400) setError(err.response.data?.message ?? '입력한 내용을 다시 확인해 주세요')
      else setError('인증 토큰을 요청하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsSending(false)
    }
  }

  const handleJoin = async () => {
    if (isBlank(token)) {
      setError('인증 토큰을 입력해 주세요')
      return
    }
    setError('')
    setIsJoining(true)
    try {
      const result = await adminApi.postJoin({ email: email.trim(), name: name.trim(), token: token.trim() })
      // 관리자가 0명이면 첫 관리자(승인권자)로 바로 로그인됨 → 세션 다시 읽고 /admin
      if (result?.adminStatus === 'ACTIVE') {
        await check()
        navigate('/admin', { replace: true })
        return
      }
      setStep('done')
    } catch (err) {
      if (err.response?.status === 429) setError('잠시 후 다시 시도해 주세요')
      else if (err.response) setError(err.response.data?.message ?? '인증 토큰을 다시 받아 주세요')
      else setError('가입 신청을 보내지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsJoining(false)
    }
  }

  if (step === 'done') {
    return (
      <Wrap>
        <Title>관리자 가입</Title>
        <Done role="status">
          <p>신청을 받았어요. 승인되면 메일로 알려 드려요.</p>
          <Hint>승인권자가 확인한 뒤 로그인할 수 있어요.</Hint>
        </Done>
        <Links>
          <Link to="/admin/login">관리자 로그인으로</Link>
        </Links>
      </Wrap>
    )
  }

  const isTokenSent = step === 'tokenSent'

  return (
    <Wrap>
      <Title>관리자 가입</Title>
      <Guide>이메일로 인증 토큰을 받아 가입을 신청해요. 승인권자가 승인하면 관리자로 로그인할 수 있어요.</Guide>
      <Field>
        이메일
        <input type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field>
        이름
        <input
          type="text"
          value={name}
          maxLength={20}
          aria-invalid={nameError !== ''}
          onChange={(event) => setName(event.target.value)}
        />
        <InlineError>{nameError}</InlineError>
        <Hint>관리자 화면에 보일 이름이에요 (2~20자)</Hint>
      </Field>
      <Button $variant={isTokenSent ? 'outline' : 'primary'} onClick={handleRequestToken} disabled={isSending || cooldown > 0}>
        {cooldown > 0 ? `인증 토큰 받기 (${cooldown}초 뒤 다시)` : isTokenSent ? '인증 토큰 다시 받기' : '인증 토큰 받기'}
      </Button>
      {notice && <Notice role="status">{notice}</Notice>}
      {isTokenSent && (
        <>
          <Field>
            인증 토큰 6자리
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={token}
              maxLength={6}
              onChange={(event) => setToken(event.target.value)}
            />
          </Field>
          <Button onClick={handleJoin} disabled={isJoining}>
            가입 신청
          </Button>
        </>
      )}
      <InlineError>{error}</InlineError>
      <Links>
        이미 관리자라면 <Link to="/admin/login">관리자 로그인</Link>
      </Links>
    </Wrap>
  )
}

export default AdminJoinPage
