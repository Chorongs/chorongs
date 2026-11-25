import { useState } from 'react'
import styled from 'styled-components'
import { PREPARING_TEXT } from '../../api/axiosInstance'
import * as myApi from '../../api/myApi'
import { LOGIN_TYPE_LABEL } from '../../constants/options'
import useAuthStore from '../../store/useAuthStore'
import useCompareStore from '../../store/useCompareStore'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, Card, InlineError } from '../../styles/common'
import { getTodayText } from '../../utils/format'
import { BIRTH_ERROR, isValidBirthDate, isValidNickname } from '../../utils/validate'
import Checkbox from '../ui/Checkbox'
import Modal from '../ui/Modal'

// MY-11 회원 정보: 닉네임, 생년월일 수정 (API-28 PATCH, 바꾼 것만 보냄) / [회원 탈퇴] (API-28 DELETE)
// 닉네임 2~12자, 앞뒤 공백 제거 (같은 닉네임 허용) / 생년월일 형식, 미래 날짜 → 오류 문구 (E2) / 400 → 서버 문구
// 탈퇴: 확인 창 필수 (되돌릴 수 없음) → '위 내용을 확인했어요' 체크 후 [탈퇴하기] → sessionStorage 비움
//   → 안내 창 → 닫으면 새로고침하며 메인(/)으로 (로그아웃과 같은 방식, 2026-11-17 사용자 결정) / 누르는 중 잠금 (E5)
// TODO(API-28, CHORONG-42 BE): 회원 정보 수정, 탈퇴 API가 아직 서버에 없어 지금은 '준비 중' 안내 (axiosInstance PREPARING_APIS 목록). 서버가 올라오면 그 목록 줄만 지우면 그대로 동작
// 검사 규칙 (명세서 MY-11, 회원 관리 기획서 3-7, 4-5, 5-4):
//   - 닉네임: 앞뒤 공백을 뺀 2자 이상 12자 이하 (isValidNickname), 글자 종류 제한 없음, 같은 닉네임 허용
//   - 생년월일: 'YYYY-MM-DD', 실제 있는 날짜, 1900-01-01 이후, 오늘 이전 (isValidBirthDate). 달력도 1900-01-01부터 오늘까지만
//   - 원래 생년월일이 있던 회원이 칸을 비우거나 덜 입력하면 오류 (덜 입력은 validity.badInput으로 구분, 브라우저가 빈 글자로 넘김)
//   - 오류는 칸 바로 아래에 입력하는 동안 바로 보이고, 오류가 남은 채 [저장]을 누르면 보내지 않고 '입력한 내용을 다시 확인해 주세요' 알림
//   - [저장]은 하나: 원래 값과 비교해 바뀐 칸만 보냄 (아무것도 안 바뀌면 보내지 않고 '바뀐 내용이 없어요')
//   - 서버 400 → 서버 문구를 맨 아래에 표시
//   - 오류 문구 BIRTH_ERROR, 오늘 날짜 getTodayText는 가입 단계와 같이 씀 (utils/validate.js, utils/format.js)
const NICKNAME_ERROR = '닉네임은 2~12자로 입력해 주세요'
// 탈퇴 때 지워지는 것 (명세서 MY-11 기록 7종 + 회원 관리 기획서 3-9의 닉네임, 생년월일, 소셜 연결 정보)
const WIPED_RECORDS = [
  '찜',
  '최근 본 대출',
  '최근 검색',
  '비교 내역',
  '저장한 추천 결과',
  '진단 리포트',
  '계산 기록',
  '닉네임, 생년월일, 소셜 연결 정보',
]

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

// 안내와 해야 할 행동이 두 문장이면 두 줄로 나눔 (글 안의 \n, white-space: pre-line. 2026-11-17 사용자 요청)
const ErrorText = styled(InlineError)`
  white-space: pre-line;
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
  // 서버가 거절한 문구 (칸 검사 오류는 아래에서 바로 계산)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // 달력 칸을 덜 입력했는지 (validity.badInput)
  const [isBirthBadInput, setIsBirthBadInput] = useState(false)
  // 탈퇴 창 단계: null 닫힘 / 'confirm' 확인 / 'done' 끝남 안내
  const [withdrawStep, setWithdrawStep] = useState(null)
  const [isChecked, setIsChecked] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  // 칸마다 지금 오류 (입력하는 동안 바로 보임)
  const hadBirth = toBirthText(user) !== ''
  const nicknameError = isValidNickname(nickname) ? '' : NICKNAME_ERROR
  const isBirthWrong = isBirthBadInput || (birth === '' ? hadBirth : !isValidBirthDate(birth))
  const birthError = isBirthWrong ? BIRTH_ERROR : ''

  // 달력 값이 바뀌거나 칸을 떠날 때 덜 입력했는지 다시 봄
  const handleBirthInput = (event) => {
    setBirth(event.target.value)
    setIsBirthBadInput(event.target.validity.badInput)
  }

  const handleSave = async () => {
    const trimmed = nickname.trim()
    // 오류가 남아 있으면 보내지 않고 다시 확인하라고 알림 (오류 문구는 칸 아래에 이미 보임)
    if (nicknameError || birthError) {
      setError('')
      showToast('입력한 내용을 다시 확인해 주세요')
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
      // 성공인데 회원 정보가 없으면 저장 실패로 안내 (내 정보를 비우면 화면이 멈춤)
      if (!updated?.memberNickname) {
        setError('저장하지 못했어요.\n다시 시도해 주세요')
        return
      }
      useAuthStore.setState({ user: updated })
      setNickname(updated.memberNickname)
      showToast('회원 정보를 저장했어요')
    } catch (err) {
      if (err.isPreparing) setError(PREPARING_TEXT)
      else if (err.response?.status === 400) setError(err.response.data?.message ?? BIRTH_ERROR)
      else if (err.response?.status !== 401) setError('저장하지 못했어요.\n다시 시도해 주세요')
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
      // 추천 입력, 결과 비우기 (ST-03 '로그아웃, 탈퇴 시 clear()'), 비교 화면 두 상품, 고르는 중 비우기 (ST-04) 뒤 이 탭의 임시 저장값 전부 비움
      useRecommendStore.getState().clear()
      useCompareStore.getState().setPickSlot(null)
      useCompareStore.getState().setPair(null, null)
      sessionStorage.clear()
      setWithdrawStep('done')
    } catch (error) {
      setWithdrawError(error.isPreparing ? PREPARING_TEXT : '탈퇴하지 못했어요.\n다시 시도해 주세요')
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
            <input
              value={nickname}
              maxLength={20}
              aria-invalid={nicknameError !== ''}
              onChange={(event) => setNickname(event.target.value)}
            />
            <InlineError>{nicknameError}</InlineError>
          </Field>
          <ReadOnly>
            로그인 방법
            <b>{LOGIN_TYPE_LABEL[user.loginType] ?? user.loginType}</b>
          </ReadOnly>
          <Field>
            생년월일
            <input
              type="date"
              value={birth}
              min="1900-01-01"
              max={getTodayText()}
              aria-invalid={birthError !== ''}
              onChange={handleBirthInput}
              onBlur={handleBirthInput}
            />
            <InlineError>{birthError}</InlineError>
            <Hint>상품의 나이 조건 확인에만 써요</Hint>
          </Field>
          <ErrorText>{error}</ErrorText>
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
          <p>탈퇴하면 아래 정보가 모두 지워지고 되돌릴 수 없어요.</p>
          <ul>
            {WIPED_RECORDS.map((record) => (
              <li key={record}>{record}</li>
            ))}
          </ul>
          <p>신고 기록은 익명으로 남고, 같은 상품은 다시 신고할 수 없어요.</p>
          <p>상품 조회 집계는 누구인지 알 수 없는 통계로만 남아요.</p>
          <p>소셜 계정 설정에서 연결을 끊을 수 있어요.</p>
          <Checkbox checked={isChecked} onChange={setIsChecked} label="위 내용을 확인했어요" />
          <ErrorText>{withdrawError}</ErrorText>
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
        <DialogText>
          탈퇴했어요.
          <br />
          개인정보와 이용 기록을 모두 지웠어요
        </DialogText>
        <DialogActions>
          <Button onClick={handleDoneClose}>확인</Button>
        </DialogActions>
      </Modal>
    </section>
  )
}

export default MemberInfo
