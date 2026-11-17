import { useState } from 'react'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { LOGIN_TYPE_LABEL } from '../../constants/options'
import useAuthStore from '../../store/useAuthStore'
import useUiStore from '../../store/useUiStore'
import { Button, Card, InlineError } from '../../styles/common'
import { isValidBirthDate, isValidNickname } from '../../utils/validate'
import Checkbox from '../ui/Checkbox'
import Modal from '../ui/Modal'

// MY-11 회원 정보: 닉네임, 생년월일 수정 (API-28 PATCH, 바꾼 것만 보냄) / [회원 탈퇴] (API-28 DELETE)
// 닉네임 2~12자, 앞뒤 공백 제거 (같은 닉네임 허용) / 생년월일 형식, 미래 날짜 → 오류 문구 (E2) / 400 → 서버 문구
// 탈퇴: 확인 창 필수 (되돌릴 수 없음) → '위 내용을 확인했어요' 체크 후 [탈퇴하기] → sessionStorage 비움
//   → 안내 창 → 닫으면 새로고침하며 메인(/)으로 (로그아웃과 같은 방식, 2026-11-17 사용자 결정) / 누르는 중 잠금 (E5)
// TODO(API-28, CHORONG-42 BE): 회원 정보 수정, 탈퇴 API는 오늘 서버 범위 밖이라 지금은 실패 문구가 뜸
const BIRTH_ERROR = '입력한 생년월일을 확인해주세요'
const WIPED_RECORDS = ['찜', '최근 본 대출', '최근 검색', '비교 내역', '계산 기록', '진단 리포트', '추천 결과']

const Head = styled.h2`
  margin-bottom: 20px;
  font-size: var(--fs-h4);
  font-weight: 800;
`

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
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

const ReadOnly = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-md);
  font-weight: 600;
  b {
    font-size: var(--fs-lg);
  }
`

const Hint = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 400;
`

const Bottom = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
`

const DialogTitle = styled.h2`
  margin-bottom: 12px;
  font-size: var(--fs-h3);
  font-weight: 800;
`

const DialogBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  ul {
    padding-left: 20px;
    list-style: disc;
  }
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

const DialogText = styled.p`
  margin-bottom: 20px;
  font-size: var(--fs-lg);
  font-weight: 700;
`

// MemberResponseDTO의 birthYear('YYYY'), birthDay('MM-DD') → 달력 값 'YYYY-MM-DD' (없으면 빈 칸)
function toBirthText(user) {
  return user.birthYear && user.birthDay ? `${user.birthYear}-${user.birthDay}` : ''
}

function MemberInfo() {
  const user = useAuthStore((state) => state.user)
  const showToast = useUiStore((state) => state.showToast)
  const [nickname, setNickname] = useState(user.memberNickname)
  const [birth, setBirth] = useState(toBirthText(user))
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // 탈퇴 창 단계: null 닫힘 / 'confirm' 확인 / 'done' 끝남 안내
  const [withdrawStep, setWithdrawStep] = useState(null)
  const [isChecked, setIsChecked] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  const handleSave = async () => {
    const trimmed = nickname.trim()
    if (!isValidNickname(trimmed)) {
      setError('닉네임은 2~12자로 입력해 주세요')
      return
    }
    if (birth !== '' && !isValidBirthDate(birth)) {
      setError(BIRTH_ERROR)
      return
    }
    const body = {}
    if (trimmed !== user.memberNickname) body.nickname = trimmed
    if (birth !== '' && birth !== toBirthText(user)) {
      body.birthYear = birth.slice(0, 4)
      body.birthDay = birth.slice(5)
    }
    if (Object.keys(body).length === 0) {
      setError('')
      showToast('바뀐 내용이 없어요')
      return
    }
    setError('')
    setIsSaving(true)
    try {
      const updated = await myApi.patchMe(body)
      useAuthStore.setState({ user: updated })
      setNickname(updated.memberNickname)
      showToast('회원 정보를 저장했어요')
    } catch (err) {
      if (err.response?.status === 400) setError(err.response.data?.message ?? BIRTH_ERROR)
      else if (err.response?.status !== 401) setError('저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  const openWithdraw = () => {
    setIsChecked(false)
    setWithdrawError('')
    setWithdrawStep('confirm')
  }

  const handleWithdraw = async () => {
    setIsWithdrawing(true)
    setWithdrawError('')
    try {
      await myApi.deleteMe()
      sessionStorage.clear()
      setWithdrawStep('done')
    } catch {
      setWithdrawError('탈퇴하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsWithdrawing(false)
    }
  }

  // 새로고침하며 메인으로: 메모리의 스토어 값이 한꺼번에 비워짐
  const handleDoneClose = () => window.location.replace('/')

  return (
    <section>
      <Head>회원 정보</Head>
      <Card>
        <Form>
          <Field>
            닉네임
            <input value={nickname} maxLength={20} onChange={(event) => setNickname(event.target.value)} />
          </Field>
          <ReadOnly>
            로그인 방법
            <b>{LOGIN_TYPE_LABEL[user.loginType] ?? user.loginType}</b>
          </ReadOnly>
          <Field>
            생년월일
            <input type="date" value={birth} min="1900-01-01" onChange={(event) => setBirth(event.target.value)} />
            <Hint>상품의 나이 조건 확인에만 써요</Hint>
          </Field>
          <InlineError>{error}</InlineError>
          <Bottom>
            <Button $variant="ghost" onClick={openWithdraw}>
              회원 탈퇴
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              저장
            </Button>
          </Bottom>
        </Form>
      </Card>

      <Modal isOpen={withdrawStep === 'confirm'} onClose={() => setWithdrawStep(null)} label="회원 탈퇴" width={460}>
        <DialogTitle>회원 탈퇴</DialogTitle>
        <DialogBody>
          <p>탈퇴하면 아래 기록이 모두 지워지고 되돌릴 수 없어요.</p>
          <ul>
            {WIPED_RECORDS.map((record) => (
              <li key={record}>{record}</li>
            ))}
          </ul>
          <p>신고 기록은 익명으로 남고, 같은 상품은 다시 신고할 수 없어요.</p>
          <p>소셜 계정 설정에서 연결을 끊을 수 있어요.</p>
          <Checkbox checked={isChecked} onChange={setIsChecked} label="위 내용을 확인했어요" />
          <InlineError>{withdrawError}</InlineError>
        </DialogBody>
        <DialogActions>
          <Button $variant="outline" onClick={() => setWithdrawStep(null)}>
            취소
          </Button>
          <Button onClick={handleWithdraw} disabled={!isChecked || isWithdrawing}>
            탈퇴하기
          </Button>
        </DialogActions>
      </Modal>

      <Modal isOpen={withdrawStep === 'done'} onClose={handleDoneClose} label="탈퇴 완료" width={380} showClose={false}>
        <DialogText>탈퇴했어요. 개인정보와 이용 기록을 모두 지웠어요</DialogText>
        <DialogActions>
          <Button onClick={handleDoneClose}>확인</Button>
        </DialogActions>
      </Modal>
    </section>
  )
}

export default MemberInfo
