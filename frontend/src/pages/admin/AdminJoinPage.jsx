import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import Icon from '../../components/ui/Icon'
import useAdminStore from '../../store/useAdminStore'
import { Button, InlineError } from '../../styles/common'
import { isBlank, isValidAdminName } from '../../utils/validate'

// AD-12 관리자 가입 (/admin/join, SCR-24): 이메일, 이름 (2~20자) → [인증 토큰 받기] (API-45 ①) → 인증 토큰 6자리 → [가입 신청] (API-45 ②)
// 토큰 칸은 204일 때만 열림, 그때 이메일·이름 칸은 잠기고 버튼 하나가 [가입 신청]으로 바뀜 / '이메일 · 이름 고치기' → 처음 단계로
// 60초 잠금은 204, 429 응답 뒤에만 (409, 400 등 메일을 안 보낸 응답은 잠그지 않음)
// 가입 신청 결과 adminStatus: ACTIVE (관리자 0명, 첫 관리자가 승인권자로 바로 로그인됨) → 세션 다시 읽고 /admin / PENDING → 완료 안내
// 409 → 서버 문구 ('이미 등록된 메일이에요. 로그인해 주세요' / '이미 신청한 메일이에요. 승인되면 메일로 알려 드려요'), 토큰 칸 안 열림
// 토큰 틀림, 10분 지남, 5번 틀림 → 400 서버 문구 ('토큰이 맞지 않아요' / '토큰을 다시 받아 주세요') / 429 → '잠시 후 다시'
// 토큰 원문은 화면 상태(useState)에만 (E14) / 연타 방지 (E5) / 일반 화면에 링크 없음 (관리자 로그인 화면에서만 이동)
const COOLDOWN_SECONDS = 60
const NAME_ERROR = '이름은 2~20자로 적어 주세요'

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
    &[aria-invalid='true'] {
      border-color: var(--bad);
    }
    @media (max-width: 899px) {
      height: 48px;
    }
  }
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

// 신청 완료 상자: 초록 바탕 + 체크 + 다음 할 일 버튼
const Done = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 22px;
  border-radius: var(--r-md);
  background: var(--good-soft);
  color: var(--ink-2);
  font-size: var(--fs-md);
  > span {
    flex: none;
    color: var(--good);
  }
  b {
    color: var(--ink);
    font-size: var(--fs-lg);
  }
  p {
    margin-top: 2px;
  }
`

const DoneLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`

const Note = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.65;
  text-align: center;
`

const LoginLink = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
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
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const isTokenSent = step === 'tokenSent'
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
    if (cooldown > 0) {
      setError(`토큰은 60초에 한 번 받을 수 있어요. ${cooldown}초 뒤에 다시 받아 주세요`)
      return
    }
    setError('')
    setNotice('')
    setIsPending(true)
    try {
      await adminApi.postJoinToken({ email: email.trim(), name: name.trim() })
      setToken('')
      setStep('tokenSent')
      setNotice('인증 토큰을 메일로 보냈어요. 10분 안에 입력해 주세요')
      setCooldown(COOLDOWN_SECONDS)
    } catch (err) {
      const code = err.response?.status
      if (code === 429) {
        setCooldown(COOLDOWN_SECONDS)
        setError('잠시 후 다시 시도해 주세요')
      } else if (code === 409 || code === 400) {
        setError(err.response.data?.message ?? '입력한 내용을 다시 확인해 주세요')
      } else {
        setError('인증 토큰을 요청하지 못했어요. 다시 시도해 주세요')
      }
    } finally {
      setIsPending(false)
    }
  }

  const handleJoin = async () => {
    if (isBlank(token)) {
      setError('인증 토큰을 입력해 주세요')
      return
    }
    setError('')
    setIsPending(true)
    try {
      const result = await adminApi.postJoin({ email: email.trim(), name: name.trim(), token: token.trim() })
      if (result?.adminStatus === 'ACTIVE') {
        // 첫 관리자: 서버가 세션도 로그인시킴 → 관리자 정보 다시 읽고 /admin
        await check()
        navigate('/admin', { replace: true })
        return
      }
      setNotice('')
      setStep('done')
    } catch (err) {
      const code = err.response?.status
      if (code === 429) setError('잠시 후 다시 시도해 주세요')
      else if (err.response) setError(err.response.data?.message ?? '인증 토큰을 다시 받아 주세요')
      else setError('가입 신청을 보내지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isTokenSent) handleJoin()
    else handleRequestToken()
  }

  // 처음 단계로: 토큰 칸 닫고 이메일, 이름 고치기
  const handleBack = () => {
    setStep('input')
    setToken('')
    setError('')
    setNotice('')
  }

  // 다른 이메일로 다시 신청: 입력값 비우고 처음부터
  const handleAgain = () => {
    setEmail('')
    setName('')
    handleBack()
  }

  return (
    <Wrap>
      <Head>
        <Mark aria-hidden="true">
          <Icon name="shield" size={30} />
        </Mark>
        <Tagline>캐링 관리자</Tagline>
        <Title>관리자 가입 신청</Title>
        <Guide>이메일을 인증하고 신청하면, 승인권자가 승인한 뒤 로그인할 수 있어요.</Guide>
      </Head>
      {step === 'done' ? (
        <Done role="status">
          <Icon name="check" size={24} />
          <div>
            <b>신청을 받았어요</b>
            <p>승인되면 메일로 알려 드려요.</p>
            <DoneLinks>
              <Button as={Link} to="/admin/login" $variant="outline" $size="sm">
                관리자 로그인
                <Icon name="arrow" size={13} />
              </Button>
              <Button $variant="outline" $size="sm" onClick={handleAgain}>
                다른 이메일로 신청
              </Button>
            </DoneLinks>
          </div>
        </Done>
      ) : (
        <>
          <Notice>{notice}</Notice>
          <Form onSubmit={handleSubmit} noValidate>
            <Field>
              이메일
              <input
                type="email"
                value={email}
                readOnly={isTokenSent}
                autoComplete="email"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="업무용 이메일"
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field>
              이름
              <input
                type="text"
                value={name}
                readOnly={isTokenSent}
                maxLength={20}
                autoComplete="off"
                placeholder="관리자 화면에 보일 이름 (2~20자)"
                aria-invalid={nameError !== ''}
                onChange={(event) => setName(event.target.value)}
              />
              <InlineError>{nameError}</InlineError>
            </Field>
            {isTokenSent && (
              <Field>
                메일로 받은 인증 토큰
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={token}
                  maxLength={6}
                  placeholder="토큰 6자리 (10분 안에)"
                  onChange={(event) => setToken(event.target.value)}
                />
              </Field>
            )}
            <InlineError>{error}</InlineError>
            <Submit type="submit" disabled={isPending}>
              {isTokenSent ? '가입 신청' : '인증 토큰 받기'}
            </Submit>
            {isTokenSent && (
              <Sub>
                <LinkButton type="button" onClick={handleBack}>
                  이메일 · 이름 고치기
                </LinkButton>
                <LinkButton type="button" onClick={handleRequestToken} disabled={isPending}>
                  토큰 다시 받기
                </LinkButton>
              </Sub>
            )}
          </Form>
        </>
      )}
      <Note>
        인증 토큰은 10분 동안 쓸 수 있고, 5번 틀리면 다시 받아야 해요.
        <br />
        관리자가 한 명도 없을 때는 첫 신청자가 바로 승인권자가 돼요.
      </Note>
      <LoginLink>
        이미 승인받았나요?
        <br />
        <Link to="/admin/login">관리자 로그인</Link>
      </LoginLink>
    </Wrap>
  )
}

export default AdminJoinPage
