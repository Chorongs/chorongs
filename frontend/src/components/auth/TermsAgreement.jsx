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

const BirthHint = styled.span`
  color: ${({ $isDone }) => ($isDone ? 'var(--good)' : 'var(--cocoa)')};
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

  const isAllAgreed = agreeService && agreePrivacy
  const isBirthDone = isValidBirthDate(birth)

  const handleAll = (checked) => {
    setAgreeService(checked)
    setAgreePrivacy(checked)
  }

  const handleSubmit = async () => {
    if (!isAllAgreed) {
      setError('필수 약관에 동의해 주세요.')
      return
    }
    if (needBirth && !isBirthDone) {
      setError(BIRTH_ERROR)
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
      if (code === 'INVALID_INPUT') setError(BIRTH_ERROR)
      else if (code === 'ADMIN_LOGGED_IN') setError('관리자로 로그인 중이에요. 관리자에서 로그아웃한 뒤 로그인해 주세요')
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
            onChange={(event) => setBirth(event.target.value)}
          />
          <BirthHint $isDone={isBirthDone}>{isBirthDone ? '생년월일 입력 완료' : '생년월일을 입력해 주세요'}</BirthHint>
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
