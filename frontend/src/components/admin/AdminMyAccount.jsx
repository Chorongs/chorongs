import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { ADMIN_ROLE_LABEL } from '../../constants/options'
import useAdminStore from '../../store/useAdminStore'
import useUiStore from '../../store/useUiStore'
import { Button, Card, InlineError } from '../../styles/common'
import { formatDateTime } from '../../utils/format'
import Modal from '../ui/Modal'
import SectionHeader from '../common/SectionHeader'

// AD-10 내 계정: 이름, 이메일, 역할, 승인 일시, 마지막 로그인 (API-47 GET) / [관리자 탈퇴]
// [관리자 탈퇴] → 확인 창 (되돌릴 수 없음, 내 이메일 다시 입력. 다르면 버튼 잠금) → API-47 DELETE → 스토어 guest → /admin/login
// 마지막 승인권자 → 서버 문구 ('다른 승인권자를 먼저 지정해 주세요') / 연타 방지 (E5) / 관리자는 언제든 탈퇴 가능
// TODO(CHORONG-57 BE): AdminResponseDTO 필드 이름(adminName, adminEmail, adminRole, approvedAt, lastLoginAt)은 DTO 파일이 올라오면 맞춘다
const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Info = styled.dl`
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px 16px;
  font-size: var(--fs-md);
  dt {
    color: var(--cocoa);
    font-weight: 600;
  }
  dd {
    font-weight: 700;
    overflow-wrap: anywhere;
  }
`

const Bottom = styled.div`
  display: flex;
  justify-content: flex-end;
`

// 관리자 목록 안 빈 상태, 안내: 테두리 없는 작은 글씨
const Status = styled.p`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 36px 0;
  color: var(--cocoa);
  font-size: var(--fs-md);
  text-align: center;
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

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

function AdminMyAccount() {
  const navigate = useNavigate()
  const showToast = useUiStore((state) => state.showToast)
  const [result, setResult] = useState({ status: 'loading', me: null })
  const [attempt, setAttempt] = useState(0)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCancelled = false
    adminApi
      .getAdminMe()
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', me: data ?? null })
      })
      .catch((err) => {
        if (!isCancelled && err.response?.status !== 401) setResult({ status: 'error', me: null })
      })
    return () => {
      isCancelled = true
    }
  }, [attempt])

  const reload = () => {
    setResult({ status: 'loading', me: null })
    setAttempt((count) => count + 1)
  }

  const openConfirm = () => {
    setEmailInput('')
    setError('')
    setIsConfirmOpen(true)
  }

  const me = result.me
  const isEmailMatched = me?.adminEmail !== undefined && emailInput.trim() === me.adminEmail

  const handleRemove = async () => {
    setError('')
    setIsRemoving(true)
    try {
      await adminApi.deleteAdminMe(emailInput.trim())
      useAdminStore.setState({ admin: null, status: 'guest', expiresAt: null })
      showToast('관리자 탈퇴를 마쳤어요')
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
      <Card>
        <Info>
          <dt>이름</dt>
          <dd>{me.adminName ?? '-'}</dd>
          <dt>이메일</dt>
          <dd>{me.adminEmail ?? '-'}</dd>
          <dt>역할</dt>
          <dd>{ADMIN_ROLE_LABEL[me.adminRole] ?? me.adminRole ?? '-'}</dd>
          <dt>승인 일시</dt>
          <dd>{formatDateTime(me.approvedAt)}</dd>
          <dt>마지막 로그인</dt>
          <dd>{formatDateTime(me.lastLoginAt)}</dd>
        </Info>
      </Card>
    )
  }

  return (
    <Wrap>
      <SectionHeader title="내 계정" description="내 관리자 정보예요." />
      {body}
      {me && (
        <Bottom>
          <Button $variant="ghost" onClick={openConfirm}>
            관리자 탈퇴
          </Button>
        </Bottom>
      )}

      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} label="관리자 탈퇴" width={460}>
        <DialogTitle>관리자 탈퇴</DialogTitle>
        <DialogBody>
          <p>탈퇴하면 되돌릴 수 없어요. 다시 관리자가 되려면 가입 신청과 승인을 다시 받아야 해요.</p>
          <p>마지막 승인권자는 탈퇴할 수 없어요. 다른 승인권자를 먼저 지정해 주세요.</p>
          <Field>
            확인을 위해 내 이메일을 다시 입력해 주세요
            <input type="email" value={emailInput} autoComplete="off" onChange={(event) => setEmailInput(event.target.value)} />
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
