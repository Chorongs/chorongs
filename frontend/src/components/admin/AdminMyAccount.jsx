import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { ADMIN_ROLE_LABEL } from '../../constants/options'
import useAdminStore from '../../store/useAdminStore'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError } from '../../styles/common'
import { approvedByText, formatDateTime, formatTime } from '../../utils/format'
import Modal from '../ui/Modal'

// AD-10 내 계정: 이름, 이메일, 역할, 로그인 끝나는 시각, 승인 일시 · 승인한 사람, 마지막 로그인 (API-47 GET) / [관리자 탈퇴]
// [관리자 탈퇴] → 확인 창 (되돌릴 수 없음, 내 이메일 다시 입력. 다르면 버튼 잠금) → API-47 DELETE → 스토어 guest → /admin/login
// 마지막 승인권자 → 열 때 정상 승인권자 수를 세어 (API-46 GET) 요청 전에 [관리자 탈퇴] 잠금 + 문구
//   목록을 못 읽으면 열어 둠, 서버 409 '다른 승인권자를 먼저 지정해 주세요'는 두 번째 방어 / 연타 방지 (E5)
// AdminResponseDTO: adminName, adminEmail, adminRole, approvedBy, approvedByName, approvedAt, lastLoginAt
const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const SecHead = styled.div`
  h2 {
    font-size: var(--fs-h4);
    font-weight: 800;
  }
  p {
    margin-top: 4px;
    color: var(--cocoa);
    font-size: var(--fs-md);
  }
`

// 내 정보: 연한 바탕 안 이름-값 두 칸
const Info = styled.dl`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 12px 28px;
  padding: 20px;
  border-radius: var(--r-md);
  background: var(--mist);
  font-size: var(--fs-md);
  dt {
    color: var(--cocoa);
    font-weight: 700;
  }
  dd {
    color: var(--ink);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  dd b {
    font-family: var(--f-num);
    font-weight: 700;
  }
`

// 탈퇴 구역: 위 구분선, 설명 왼쪽 + 버튼 오른쪽
const Out = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
  b {
    font-size: var(--fs-base);
    font-weight: 800;
  }
  p {
    margin-top: 4px;
    color: var(--cocoa);
    font-size: var(--fs-sm);
  }
  @media (max-width: 899px) {
    flex-direction: column;
  }
`

// 관리자 목록 안 빈 상태, 안내: 테두리 없는 작은 글씨
const Status = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 36px 20px;
  border-bottom: 1px solid var(--line);
  color: var(--cocoa);
  font-size: var(--fs-md);
  text-align: center;
`

// 마지막 승인권자라 탈퇴를 잠갔을 때 설명 아래 안내 (주의 색)
const LockNote = styled.strong`
  display: block;
  margin-top: 8px;
  color: var(--warn);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const DialogTitle = styled.h2`
  margin-bottom: 16px;
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
`

const Mine = styled.p`
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--brand-soft);
  line-height: 1.6;
`

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
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
    &:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px var(--brand-soft);
      outline: none;
    }
    @media (max-width: 899px) {
      height: 48px;
    }
  }
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

const LAST_APPROVER_TEXT = '마지막 승인권자라 탈퇴할 수 없어요. 관리자 계정에서 다른 승인권자를 먼저 지정해 주세요'

// 정상 승인권자가 나 혼자인지 (서버와 같은 기준: 정상 + 승인권자, 잠김도 셈). 목록을 못 읽으면 false (버튼은 열어 둠)
async function checkLastApprover() {
  try {
    const admins = await adminApi.getAdmins('ACTIVE')
    return (admins ?? []).filter((admin) => admin.adminRole === 'APPROVER').length <= 1
  } catch {
    return false
  }
}

// 승인한 사람: 이름 / 번호만 있으면 탈퇴한 관리자 / 번호도 없으면 첫 관리자
function AdminMyAccount() {
  const navigate = useNavigate()
  const expiresAt = useAdminStore((state) => state.expiresAt)
  const showToast = useUiStore((state) => state.showToast)
  const [result, setResult] = useState({ status: 'loading', me: null, isLastApprover: false })
  const [attempt, setAttempt] = useState(0)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCancelled = false
    // 내 정보 + (승인권자면) 마지막 승인권자 여부를 다 받은 뒤 그림 (버튼이 열렸다 잠기는 깜빡임 없게)
    adminApi
      .getAdminMe()
      .then(async (data) => {
        const me = data ?? null
        const isLastApprover = me?.adminRole === 'APPROVER' ? await checkLastApprover() : false
        if (!isCancelled) setResult({ status: 'done', me, isLastApprover })
      })
      .catch((err) => {
        if (!isCancelled && err.response?.status !== 401) setResult({ status: 'error', me: null, isLastApprover: false })
      })
    return () => {
      isCancelled = true
    }
  }, [attempt])

  const reload = () => {
    setResult({ status: 'loading', me: null, isLastApprover: false })
    setAttempt((count) => count + 1)
  }

  const openConfirm = () => {
    setEmailInput('')
    setError('')
    setIsConfirmOpen(true)
  }

  const me = result.me
  // 이메일은 대소문자 상관없이 같으면 통과 (서버도 소문자로 맞춤)
  const isEmailMatched = Boolean(me?.adminEmail) && emailInput.trim().toLowerCase() === me.adminEmail.toLowerCase()

  const handleRemove = async () => {
    setError('')
    setIsRemoving(true)
    try {
      await adminApi.deleteAdminMe(emailInput.trim())
      useAdminStore.setState({ admin: null, status: 'guest', expiresAt: null })
      showToast('관리자에서 탈퇴했어요. 이메일과 이름을 지웠어요')
      navigate('/admin/login', { replace: true })
    } catch (err) {
      if (err.response?.status !== 401) setError(err.response?.data?.message ?? '탈퇴하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsRemoving(false)
    }
  }

  let body
  if (result.status === 'loading') {
    body = <Status role="status">불러오는 중이에요</Status>
  } else if (result.status === 'error' || !me) {
    body = (
      <Status>
        내 계정 정보를 불러오지 못했어요
        <Button $size="sm" $variant="outline" onClick={reload}>
          다시 시도
        </Button>
      </Status>
    )
  } else {
    body = (
      <>
        <Info>
          <dt>이름</dt>
          <dd>{me.adminName ?? '-'}</dd>
          <dt>이메일</dt>
          <dd>{me.adminEmail ?? '-'}</dd>
          <dt>역할</dt>
          <dd>{ADMIN_ROLE_LABEL[me.adminRole] ?? me.adminRole ?? '-'}</dd>
          <dt>로그인</dt>
          <dd>
            <b>{formatTime(expiresAt)}</b>까지 (2시간 고정, 활동해도 늘어나지 않아요)
          </dd>
          <dt>승인</dt>
          <dd>{me.approvedAt ? `${formatDateTime(me.approvedAt)} · ${approvedByText(me)}` : '-'}</dd>
          <dt>마지막 로그인</dt>
          <dd>{formatDateTime(me.lastLoginAt)}</dd>
        </Info>
        <Out>
          <div>
            <b>관리자 탈퇴</b>
            <p>탈퇴하면 이메일과 이름을 지우고 바로 로그아웃해요. 남긴 기록은 ‘탈퇴한 관리자’로 보여요. 같은 이메일로 다시 쓰려면 새로 가입 신청해야 해요.</p>
            {result.isLastApprover && <LockNote>{LAST_APPROVER_TEXT}</LockNote>}
          </div>
          <Button $size="sm" $variant="outline" onClick={openConfirm} disabled={result.isLastApprover}>
            관리자 탈퇴
          </Button>
        </Out>
      </>
    )
  }

  return (
    <Wrap aria-labelledby="admin-me-title">
      <SecHead>
        <h2 id="admin-me-title">내 계정</h2>
        <p>내 관리자 정보와 로그인 시간을 확인해요.</p>
      </SecHead>
      {body}

      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} label="관리자 탈퇴" width={460} showClose={false}>
        <DialogTitle>관리자에서 탈퇴할까요?</DialogTitle>
        <DialogBody>
          <Mine>되돌릴 수 없어요. 확인을 위해 내 이메일을 다시 입력해 주세요.</Mine>
          <Field>
            내 이메일
            <input
              type="email"
              value={emailInput}
              autoComplete="off"
              placeholder={me?.adminEmail ?? ''}
              onChange={(event) => setEmailInput(event.target.value)}
            />
          </Field>
          <InlineError>{error}</InlineError>
        </DialogBody>
        <DialogActions>
          <Button $variant="outline" onClick={() => setIsConfirmOpen(false)}>
            취소
          </Button>
          <Button onClick={handleRemove} disabled={!isEmailMatched || isRemoving}>
            탈퇴하기
          </Button>
        </DialogActions>
      </Modal>
    </Wrap>
  )
}

export default AdminMyAccount
