import { useState } from 'react'
import styled from 'styled-components'
import * as myApi from '../../api/myApi'
import { LOGIN_TYPE_LABEL } from '../../constants/options'
import useAuthStore from '../../store/useAuthStore'
import useCompareStore from '../../store/useCompareStore'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, Card, InlineError, InputField } from '../../styles/common'
import { BIRTH_ERROR, isAdultBirthDate, isValidNickname } from '../../utils/validate'
import BirthDateField from '../auth/BirthDateField'
import ConfirmDialog from '../common/ConfirmDialog'
import SectionHeader from '../common/SectionHeader'
import Checkbox from '../ui/Checkbox'

// MY-11 회원 정보: 닉네임, 생년월일 수정 (API-28 PATCH, 바꾼 것만 보냄) / [회원 탈퇴] (API-28 DELETE)
// 닉네임 2~12자, 앞뒤 공백 제거 (같은 닉네임 허용) / 생년월일 형식, 미래 날짜, 만 19세 미만 → 오류 문구 (E2) / 400 → 서버 문구
// 탈퇴: 확인 창 필수 (되돌릴 수 없음) → '위 내용을 확인했어요' 체크 + 칸에 '탈퇴할게요' 입력(앞뒤 공백 무시) 후 [탈퇴하기] → sessionStorage 비움
//   → 안내 창 → 닫으면 새로고침하며 메인(/)으로 (로그아웃과 같은 방식) / 누르는 중 잠금 (E5)
// 검사 규칙 (명세서 MY-11, 회원 관리 기획서 3-7, 4-5, 5-4):
//   - 닉네임: 앞뒤 공백을 뺀 2자 이상 12자 이하 (isValidNickname), 글자 종류 제한 없음, 같은 닉네임 허용
//   - 생년월일: 숫자 8자리 입력 (BirthDateField) → 'YYYY-MM-DD', 실제 있는 날짜, 1900-01-01 이후, 오늘 이전, 만 19세 이상 (isAdultBirthDate)
//   - 원래 생년월일이 있던 회원이 칸을 비우거나 덜 치면 저장 안 됨
//   - 오류는 칸 바로 아래에 치는 동안 바로 보임 (닉네임 글, 생년월일 칸 안내는 BirthDateField)
//     오류가 남은 채 [저장]을 누르면 보내지 않고 '입력한 내용을 다시 확인해 주세요' 알림 (생년월일이 비었거나 덜 쳤으면 그때 칸 아래도 오류로)
//   - [저장]은 하나: 원래 값과 비교해 바뀐 칸만 보냄 (아무것도 안 바뀌면 보내지 않고 '바뀐 내용이 없어요')
//   - 서버 400 → 서버 문구를 맨 아래에 표시
//   - 생년월일 칸, 오류 문구 BIRTH_ERROR는 가입 단계와 같이 씀 (BirthDateField, utils/validate.js)
const NICKNAME_ERROR = '닉네임은 2~12자로 입력해 주세요'
// 탈퇴 확인 창에서 한 번 더 받는 글 (실수로 탈퇴하지 않게)
const WITHDRAW_PHRASE = '탈퇴할게요'
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

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
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

// 안내와 해야 할 행동이 두 문장이면 두 줄로 나눔 (글 안의 \n, white-space: pre-line)
const ErrorText = styled(InlineError)`
  white-space: pre-line;
`

// MemberResponseDTO의 birthYear('YYYY'), birthDay('MM-DD') → 칸 값 'YYYY-MM-DD' (없으면 빈 칸)
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
  // 생년월일을 다시 치기 전에 [저장]을 눌렀는지 (비었거나 덜 친 날짜를 그때 오류로 보임)
  const [isSaveTried, setIsSaveTried] = useState(false)
  // 탈퇴 창 단계: null 닫힘 / 'confirm' 확인 / 'done' 끝남 안내
  const [withdrawStep, setWithdrawStep] = useState(null)
  const [isChecked, setIsChecked] = useState(false)
  const [withdrawText, setWithdrawText] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  // 칸마다 지금 오류 (치는 동안 바로 보임)
  const hadBirth = toBirthText(user) !== ''
  const nicknameError = isValidNickname(nickname) ? '' : NICKNAME_ERROR
  const isBirthWrong = birth === '' ? hadBirth : !isAdultBirthDate(birth)

  const handleBirthChange = (text) => {
    setBirth(text)
    setIsSaveTried(false)
  }

  const handleSave = async () => {
    const trimmed = nickname.trim()
    // 오류가 남아 있으면 보내지 않고 다시 확인하라고 알림 (닉네임 오류는 칸 아래에 이미 보이고, 비었거나 덜 친 생년월일은 이때 칸 아래도 오류로)
    if (nicknameError || isBirthWrong) {
      setIsSaveTried(true)
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
      if (err.response?.status === 400) setError(err.response.data?.message ?? BIRTH_ERROR)
      else if (err.response?.status !== 401) setError('저장하지 못했어요.\n다시 시도해 주세요')
    } finally {
      setIsSaving(false)
    }
  }

  const openWithdraw = () => {
    setIsChecked(false)
    setWithdrawText('')
    setWithdrawError('')
    setWithdrawStep('confirm')
  }

  const handleWithdraw = async () => {
    setIsWithdrawing(true)
    setWithdrawError('')
    try {
      await myApi.deleteMe()
      // 추천 입력, 결과 비우기 (ST-03 '로그아웃, 탈퇴 시 clear()'), 비교함, 비교 화면 두 상품 비우기 (ST-04) 뒤 이 탭의 임시 저장값 전부 비움
      useRecommendStore.getState().clear()
      useCompareStore.getState().clearTray()
      useCompareStore.getState().setPair(null, null)
      sessionStorage.clear()
      setWithdrawStep('done')
    } catch (error) {
      // 401은 axiosInstance가 로그인 안내 창을 띄우므로 화면 글을 겹쳐 띄우지 않음 (E4)
      if (error.response?.status !== 401) setWithdrawError('탈퇴하지 못했어요.\n다시 시도해 주세요')
    } finally {
      setIsWithdrawing(false)
    }
  }

  // 새로고침하며 메인으로: 메모리의 스토어 값이 한꺼번에 비워짐
  const handleDoneClose = () => window.location.replace('/')

  return (
    <section>
      <SectionHeader title="회원 정보" description="닉네임과 생년월일을 바꿀 수 있어요." size="md" />
      <Card>
        <Form>
          <InputField>
            닉네임
            <input
              value={nickname}
              maxLength={20}
              aria-invalid={nicknameError !== ''}
              onChange={(event) => setNickname(event.target.value)}
            />
            <InlineError>{nicknameError}</InlineError>
          </InputField>
          <ReadOnly>
            로그인 방법
            <b>{LOGIN_TYPE_LABEL[user.loginType] ?? user.loginType}</b>
          </ReadOnly>
          <BirthDateField value={birth} onChange={handleBirthChange} forceError={isSaveTried && isBirthWrong}>
            <Hint>상품의 나이 조건 확인에만 써요</Hint>
          </BirthDateField>
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

      <ConfirmDialog
        isOpen={withdrawStep === 'confirm'}
        onClose={() => setWithdrawStep(null)}
        label="회원 탈퇴"
        title="회원 탈퇴"
        titleSize="lg"
        confirmLabel="탈퇴하기"
        onConfirm={handleWithdraw}
        isConfirmDisabled={!isChecked || withdrawText.trim() !== WITHDRAW_PHRASE || isWithdrawing}
        width={460}
        showClose
      >
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
          <InputField>
            {`확인을 위해 '${WITHDRAW_PHRASE}'를 입력해 주세요`}
            <input
              value={withdrawText}
              placeholder={WITHDRAW_PHRASE}
              maxLength={20}
              autoComplete="off"
              onChange={(event) => setWithdrawText(event.target.value)}
            />
          </InputField>
          <ErrorText>{withdrawError}</ErrorText>
        </DialogBody>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={withdrawStep === 'done'}
        onClose={handleDoneClose}
        label="탈퇴 완료"
        title={
          <>
            탈퇴했어요.
            <br />
            개인정보와 이용 기록을 모두 지웠어요
          </>
        }
        confirmLabel="확인"
        onConfirm={handleDoneClose}
        cancelLabel={null}
      />
    </section>
  )
}

export default MemberInfo
