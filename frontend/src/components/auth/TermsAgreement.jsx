import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as authApi from '../../api/authApi'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError } from '../../styles/common'
import { ADMIN_SESSION_TEXT } from '../../utils/requireLogin'
import { BIRTH_ERROR, isValidBirthDate } from '../../utils/validate'
import TermsDialog from '../common/TermsDialog'
import AuthLayout from '../layout/AuthLayout'
import Checkbox from '../ui/Checkbox'
import BirthDateField from './BirthDateField'

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
//   - 생년월일 칸은 숫자 8자리 입력 (BirthDateField). 덜 친 날짜는 칸을 떠났거나 [시작하기]를 눌렀을 때 오류로 보임
//   - 생년월일 칸, 오류 문구 BIRTH_ERROR는 MY 회원 정보와 같이 씀 (BirthDateField, utils/validate.js)

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

// $tone: info 안내 / bad 오류 / good 입력 완료
const HINT_COLOR = { info: 'var(--cocoa)', bad: 'var(--bad)', good: 'var(--good)' }

const BirthHint = styled.span`
  color: ${({ $tone }) => HINT_COLOR[$tone]};
  font-size: var(--fs-sm);
  font-weight: 600;
`

// 안내와 해야 할 행동이 두 문장이면 두 줄로 나눔 (글 안의 \n, white-space: pre-line)
const ErrorText = styled(InlineError)`
  white-space: pre-line;
`

const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 8px;
`

function TermsAgreement({ needBirth, onDone }) {
  const navigate = useNavigate()
  const showToast = useUiStore((state) => state.showToast)
  const [agreeService, setAgreeService] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [birth, setBirth] = useState('')
  const [termsKind, setTermsKind] = useState(null)
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)
  // 생년월일 칸을 떠난 적 있는지 / [시작하기]를 눌러 봤는지 / 서버가 생년월일을 거절했는지(400 INVALID_INPUT)
  const [isBirthTouched, setIsBirthTouched] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isServerBirthError, setIsServerBirthError] = useState(false)

  const isAllAgreed = agreeService && agreePrivacy
  const isBirthDone = isValidBirthDate(birth) && !isServerBirthError
  // 칸 아래 안내: 정상 → 6-3 / 8자리를 다 쳤는데 틀림, 덜 친 채 칸을 떠남, 눌렀는데 비어 있거나 덜 침, 서버 거절 → 6-2 / 그 밖(아직 안 씀, 치는 중) → 6-1
  const isBirthComplete = birth.length === 10
  const isBirthError = !isBirthDone && ((birth !== '' && (isBirthComplete || isBirthTouched)) || isSubmitted || isServerBirthError)
  let birthHint = { tone: 'info', text: '생년월일을 입력해 주세요' }
  if (isBirthDone) birthHint = { tone: 'good', text: '생년월일 입력 완료' }
  else if (isBirthError) birthHint = { tone: 'bad', text: BIRTH_ERROR }

  const handleBirthChange = (text) => {
    setBirth(text)
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
      // 성공인데 회원 정보가 없으면 가입 실패로 안내 (화면이 멈추지 않게)
      if (!user?.memberNickname) {
        setError('가입하지 못했어요.\n다시 시도해 주세요')
        setIsPending(false)
        return
      }
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
      } else if (code === 'ADMIN_LOGGED_IN') setError(ADMIN_SESSION_TEXT)
      else setError('가입하지 못했어요.\n다시 시도해 주세요')
      setIsPending(false)
    }
  }

  return (
    <AuthLayout mark="logo" title="캐링 가입하기">
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
        <BirthDateField
          value={birth}
          onChange={handleBirthChange}
          onBlur={() => setIsBirthTouched(true)}
          isInvalid={birthHint.tone === 'bad'}
        >
          <BirthHint $tone={birthHint.tone} role={birthHint.tone === 'bad' ? 'alert' : undefined}>
            {birthHint.text}
          </BirthHint>
        </BirthDateField>
      )}

      <ErrorText>{error}</ErrorText>

      <Actions>
        <Button $variant="outline" onClick={() => navigate('/login')}>
          취소
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          시작하기
        </Button>
      </Actions>

      <TermsDialog kind={termsKind} onClose={() => setTermsKind(null)} />
    </AuthLayout>
  )
}

export default TermsAgreement
