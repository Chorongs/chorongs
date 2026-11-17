import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as authApi from '../../api/authApi'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError, Panel } from '../../styles/common'
import { isValidBirthDate } from '../../utils/validate'
import TermsDialog from '../common/TermsDialog'
import Checkbox from '../ui/Checkbox'

// AU-03 약관 동의, 생년월일 입력: 가입 단계 (OAuthCallbackPage의 result=SIGNUP)
// needBirth: true면 생년월일 입력칸 (카카오는 항상, 네이버는 비어 왔을 때만) / false면 생년월일은 안 보냄 (API-50)
// [시작하기] → API-50 → onDone(회원 정보) / [취소] → /login (서버 요청 없음, 가입 대기는 10분 뒤 사라짐)
// 누르는 중 잠금 (E5) / 생년월일 형식, 미래 날짜, 1900년 이전은 보내기 전에 검사 (E2)
// 검사 규칙 (회원 관리 기획서 4-2, 4-7, 5-1):
//   - 필수 약관 2개(이용약관, 개인정보 수집/이용)를 모두 체크해야 함 → 아니면 맨 아래 '필수 약관에 동의해 주세요.' (문구 1)
//   - 생년월일(needBirth일 때만, 필수): 'YYYY-MM-DD', 실제 있는 날짜, 1900-01-01 이후, 오늘 이전 (isValidBirthDate)
//   - 생년월일 안내는 칸 바로 아래에 입력하는 동안 바로 바뀜: 비어 있음 '생년월일을 입력해 주세요'(6-1)
//     / 덜 입력, 범위 밖, [시작하기]를 눌렀는데 비어 있음, 서버 400 INVALID_INPUT '입력한 생년월일을 확인해주세요'(6-2)
//     / 정상 '생년월일 입력 완료'(6-3)
//   - 덜 입력한 날짜는 브라우저가 값을 빈 글자로 넘기므로 validity.badInput으로 따로 구분
const BIRTH_ERROR = '입력한 생년월일을 확인해주세요'

const Wrap = styled(Panel)`
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 520px;
  margin: 0 auto;
`

const Title = styled.h1`
  font-size: var(--fs-h3);
  font-weight: 800;
`

const AgreeList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
`

const AgreeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const ViewButton = styled.button.attrs({ type: 'button' })`
  flex: none;
  padding: 4px;
  border: 0;
  background: transparent;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
`

const BirthField = styled.label`
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
  }
`

// $tone: info 안내 / bad 오류 / good 입력 완료
const HINT_COLOR = { info: 'var(--cocoa)', bad: 'var(--bad)', good: 'var(--good)' }

const BirthHint = styled.span`
  color: ${({ $tone }) => HINT_COLOR[$tone]};
  font-size: var(--fs-sm);
  font-weight: 600;
`

const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 8px;
`

// 오늘 날짜 'YYYY-MM-DD' (달력에서 미래 날짜를 못 고르게)
function getTodayText() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function TermsAgreement({ needBirth, onDone }) {
  const navigate = useNavigate()
  const showToast = useUiStore((state) => state.showToast)
  const [agreeService, setAgreeService] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [birth, setBirth] = useState('')
  const [termsKind, setTermsKind] = useState(null)
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)
  // 덜 입력한 날짜인지 (validity.badInput) / [시작하기]를 눌러 봤는지 / 서버가 생년월일을 거절했는지(400 INVALID_INPUT)
  const [isBirthBadInput, setIsBirthBadInput] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isServerBirthError, setIsServerBirthError] = useState(false)

  const isAllAgreed = agreeService && agreePrivacy
  const isBirthDone = isValidBirthDate(birth) && !isBirthBadInput && !isServerBirthError
  // 칸 아래 안내: 정상 → 6-3 / 덜 입력, 형식·범위 오류, 눌렀는데 비어 있음, 서버 거절 → 6-2 / 그 밖(아직 안 씀) → 6-1
  const isBirthError = !isBirthDone && (isBirthBadInput || birth !== '' || isSubmitted || isServerBirthError)
  let birthHint = { tone: 'info', text: '생년월일을 입력해 주세요' }
  if (isBirthDone) birthHint = { tone: 'good', text: '생년월일 입력 완료' }
  else if (isBirthError) birthHint = { tone: 'bad', text: BIRTH_ERROR }

  // 달력 값이 바뀌거나 칸을 떠날 때 덜 입력했는지 다시 봄
  const handleBirthInput = (event) => {
    setBirth(event.target.value)
    setIsBirthBadInput(event.target.validity.badInput)
    setIsServerBirthError(false)
  }

  const handleAll = (checked) => {
    setAgreeService(checked)
    setAgreePrivacy(checked)
  }

  const handleSubmit = async () => {
    setIsSubmitted(true)
    // 필수 약관 2개 모두 체크 (문구 1)
    if (!isAllAgreed) {
      setError('필수 약관에 동의해 주세요.')
      return
    }
    // 생년월일이 정상이 아니면 보내지 않음 (오류 문구는 칸 아래에 이미 보임, 6-2)
    if (needBirth && !isBirthDone) {
      setError('')
      return
    }
    setError('')
    setIsPending(true)
    const body = { termsAgreed: true }
    if (needBirth) {
      body.birthYear = birth.slice(0, 4)
      body.birthDay = birth.slice(5)
    }
    try {
      const user = await authApi.postSignup(body)
      onDone(user)
    } catch (err) {
      const code = err.response?.data?.code
      if (code === 'SIGNUP_EXPIRED') {
        showToast('시간이 만료되었어요. 다시 진행 해주세요.')
        navigate('/login', { replace: true })
        return
      }
      if (code === 'INVALID_INPUT') {
        setError('')
        setIsServerBirthError(true)
      } else if (code === 'ADMIN_LOGGED_IN') setError('관리자로 로그인 중이에요. 관리자에서 로그아웃한 뒤 로그인해 주세요')
      else setError('가입하지 못했어요. 다시 시도해 주세요')
      setIsPending(false)
    }
  }

  return (
    <Wrap>
      <Title>캐링 가입하기</Title>

      <Checkbox checked={isAllAgreed} onChange={handleAll} label="전체 동의" />
      <AgreeList>
        <AgreeRow>
          <Checkbox checked={agreeService} onChange={setAgreeService} label="[필수] 이용약관" />
          <ViewButton aria-label="이용약관 보기" onClick={() => setTermsKind('service')}>
            보기
          </ViewButton>
        </AgreeRow>
        <AgreeRow>
          <Checkbox checked={agreePrivacy} onChange={setAgreePrivacy} label="[필수] 개인정보 수집/이용" />
          <ViewButton aria-label="개인정보 수집/이용 보기" onClick={() => setTermsKind('privacy')}>
            보기
          </ViewButton>
        </AgreeRow>
      </AgreeList>

      {needBirth && (
        <BirthField>
          생년월일
          <input
            type="date"
            value={birth}
            min="1900-01-01"
            max={getTodayText()}
            aria-invalid={birthHint.tone === 'bad'}
            onChange={handleBirthInput}
            onBlur={handleBirthInput}
          />
          <BirthHint $tone={birthHint.tone} role={birthHint.tone === 'bad' ? 'alert' : undefined}>
            {birthHint.text}
          </BirthHint>
        </BirthField>
      )}

      <InlineError>{error}</InlineError>

      <Actions>
        <Button $variant="outline" onClick={() => navigate('/login')}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          시작하기
        </Button>
      </Actions>

      <TermsDialog kind={termsKind} onClose={() => setTermsKind(null)} />
    </Wrap>
  )
}

export default TermsAgreement
