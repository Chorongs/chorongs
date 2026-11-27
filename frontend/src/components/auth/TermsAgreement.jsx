import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as authApi from '../../api/authApi'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError } from '../../styles/common'
import { ADMIN_SESSION_TEXT } from '../../utils/requireLogin'
import { RECHECK_INPUT_TEXT, isAdultBirthDate } from '../../utils/validate'
import TermsDialog from '../common/TermsDialog'
import AuthLayout from '../layout/AuthLayout'
import Checkbox from '../ui/Checkbox'
import BirthDateField from './BirthDateField'

// AU-03 약관 동의, 생년월일 입력: 가입 단계 (OAuthCallbackPage의 result=SIGNUP)
// needBirth: true면 생년월일 입력칸 (카카오는 항상, 네이버는 비어 왔을 때만) / false면 생년월일은 안 보냄 (API-50)
// [시작하기] → API-50 → onDone(회원 정보) / [취소] → /login (서버 요청 없음, 가입 대기는 10분 뒤 사라짐)
// 누르는 중 잠금 (E5) / 생년월일 형식, 미래 날짜, 1900년 이전, 만 19세 미만은 보내기 전에 검사 (E2)
// 검사 규칙 (회원 관리 기획서 4-2, 4-7, 5-1):
//   - 필수 약관 2개(이용약관, 개인정보 수집/이용)를 모두 체크해야 함 → 아니면 맨 아래 '필수 약관에 동의해 주세요.' (문구 1)
//   - 생년월일(needBirth일 때만, 필수): 'YYYY-MM-DD', 실제 있는 날짜, 1900-01-01 이후, 오늘 이전, 만 19세 이상 (isAdultBirthDate)
//   - 생년월일 칸은 숫자 8자리 입력, 칸 아래 안내는 치는 동안 바로 바뀜 (BirthDateField, MY 회원 정보와 같이 씀):
//     비었거나 치는 중 → 회색 안내(6-1) / 틀림 → '입력한 생년월일을 확인해 주세요'(6-2) / 정상 → '생년월일 입력 완료'(6-3)
//   - [시작하기]를 눌렀는데 비었거나 덜 침, 서버 400 INVALID_INPUT도 6-2 (다시 치기 시작하면 실시간 안내로 돌아감)
//   - [시작하기]가 막히면(약관 빠짐, 생년월일 틀림) 보내지 않고 알림 RECHECK_INPUT_TEXT + 틀린 곳 표시:
//     체크 안 한 [필수] 약관 글 빨간색 (체크하면 바로 돌아옴), 생년월일 칸 테두리 빨간색 (InputField aria-invalid)

// [필수] 약관 글: [시작하기]를 눌렀는데 체크 안 했으면 빨간색
const RequiredLabel = styled.span`
  ${({ $isMissing }) => $isMissing && 'color: var(--bad);'}
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
  // 생년월일을 다시 치기 전에 [시작하기]를 눌렀는지 / 서버가 생년월일을 거절했는지(400 INVALID_INPUT)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isServerBirthError, setIsServerBirthError] = useState(false)
  // [시작하기]를 한 번이라도 눌렀는지 (체크 안 한 [필수] 약관 글을 빨간색으로)
  const [isStartTried, setIsStartTried] = useState(false)

  const isAllAgreed = agreeService && agreePrivacy
  const isBirthDone = isAdultBirthDate(birth) && !isServerBirthError
  // 눌렀는데 아직 맞는 날짜가 아님, 서버가 거절함 → 칸 아래를 오류로 (그 밖은 BirthDateField가 치는 동안 정함)
  const isBirthForcedError = isServerBirthError || (isSubmitted && !isAdultBirthDate(birth))

  const handleBirthChange = (text) => {
    setBirth(text)
    setIsSubmitted(false)
    setIsServerBirthError(false)
  }

  const handleAll = (checked) => {
    setAgreeService(checked)
    setAgreePrivacy(checked)
  }

  const handleSubmit = async () => {
    setIsSubmitted(true)
    setIsStartTried(true)
    // 필수 약관 2개 모두 체크 (문구 1)
    if (!isAllAgreed) {
      setError('필수 약관에 동의해 주세요.')
      showToast(RECHECK_INPUT_TEXT)
      return
    }
    // 생년월일이 정상이 아니면 보내지 않음 (오류 문구는 칸 아래에 이미 보임, 6-2)
    if (needBirth && !isBirthDone) {
      setError('')
      showToast(RECHECK_INPUT_TEXT)
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
        showToast('가입 시간이 지났어요. 다시 로그인해 주세요')
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
          <Checkbox
            checked={agreeService}
            onChange={setAgreeService}
            label={<RequiredLabel $isMissing={isStartTried && !agreeService}>[필수] 이용약관</RequiredLabel>}
          />
          <ViewButton aria-label="이용약관 보기" onClick={() => setTermsKind('service')}>
            보기
          </ViewButton>
        </AgreeRow>
        <AgreeRow>
          <Checkbox
            checked={agreePrivacy}
            onChange={setAgreePrivacy}
            label={<RequiredLabel $isMissing={isStartTried && !agreePrivacy}>[필수] 개인정보 수집/이용</RequiredLabel>}
          />
          <ViewButton aria-label="개인정보 수집/이용 보기" onClick={() => setTermsKind('privacy')}>
            보기
          </ViewButton>
        </AgreeRow>
      </AgreeList>

      {needBirth && (
        <BirthDateField
          value={birth}
          onChange={handleBirthChange}
          forceError={isBirthForcedError}
          doneText="생년월일 입력 완료"
        />
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
