import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { ADMIN_ROLE_LABEL, ADMIN_STATUS_LABEL } from '../../constants/options'
import useAdminStore from '../../store/useAdminStore'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError, Tag } from '../../styles/common'
import { formatDateTime } from '../../utils/format'
import ChipGroup from '../ui/ChipGroup'
import Modal from '../ui/Modal'
import SelectField from '../ui/SelectField'

// AD-09 관리자 계정 (승인권자만): 칩 (승인 대기 / 정상) / 줄: 이름(+나), 이메일 / 상태, 역할 딱지 / 신청 시각 또는 마지막 로그인 · 승인한 사람 / 처리 버튼
// [승인] → 역할 고르기 (기본 관리자) → API-46 approve / [거절] → 확인 창 → API-46 reject / [해제] → 확인 창 → API-46 DELETE
// [역할 바꾸기] → 역할 고르기 → PATCH / [잠금 풀기] → POST unlock (lockedUntil이 있을 때만 보임 = 지금 잠겨 있음)
// 끝나면 목록 다시 불러옴 + 알림 + onChanged() (메뉴 승인 대기 개수) / 내 줄은 버튼 대신 [내 계정]
// 403 → 승인권자 아님 안내 후 상품 업데이트로 / 409 → '다른 승인권자가 먼저 처리함' + 다시 불러오기 / 404 (거절, 이미 지워짐) → 다시 불러오기
// 마지막 승인권자 보호 → 서버 문구 ('다른 승인권자를 먼저 지정해 주세요') / 연타 방지 (E5) / 탈퇴, 해제한 관리자는 목록에 없음
// AdminResponseDTO: adminId, adminName, adminEmail, adminRole, adminStatus, lockedUntil, approvedBy, approvedByName, requestedAt, approvedAt, lastLoginAt
const ROLE_OPTIONS = Object.entries(ADMIN_ROLE_LABEL).map(([value, label]) => ({ value, label }))

// 역할 설명 (시안)
const ROLE_DESC = {
  MANAGER: '상품 관리 (불러오기 · 반영 · 자동 내림 확인 · 되돌리기 · 신고 처리)',
  APPROVER: '상품 관리 + 가입 승인 · 역할 바꾸기 · 잠금 풀기 · 해제',
}

const CHIP_OPTIONS = Object.entries(ADMIN_STATUS_LABEL).map(([value, label]) => ({ value, label }))

// 확인 창 종류별 제목, 설명, 버튼 글
const DIALOG_TEXT = {
  approve: { title: '님의 가입을 승인할까요?', body: '승인하면 로그인 안내를 메일로 보내요.', button: '승인하기' },
  role: { title: '님의 역할을 바꿀까요?', button: '바꾸기' },
  reject: { title: '님의 신청을 거절할까요?', body: '신청 정보(이메일 · 이름)를 바로 지워요. 메일은 보내지 않아요.', button: '거절하기' },
  remove: {
    title: '님을 관리자에서 해제할까요?',
    body: '되돌릴 수 없어요. 이메일과 이름을 지우고, 이 사람이 남긴 기록은 ‘탈퇴한 관리자’로 보여요. 접속 중이면 다음 요청에서 끊겨요.',
    button: '해제하기',
  },
}

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const SecHead = styled.div`
  margin-bottom: 8px;
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

// 줄 (시안 adm-row acct): 이름·이메일 | 딱지 | 보조 글 | 버튼
const List = styled.div`
  border-top: 2px solid var(--ink);
`

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px minmax(0, 1.2fr) 232px;
  gap: 16px;
  align-items: center;
  padding: 16px 6px;
  border-bottom: 1px solid var(--line);
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 12px;
    padding: 14px 4px;
  }
`

const Name = styled.span`
  min-width: 0;
  b {
    display: block;
    font-size: var(--fs-base);
    font-weight: 800;
    line-height: 1.4;
  }
  small {
    display: block;
    margin-top: 2px;
    color: var(--cocoa);
    font-size: var(--fs-xs);
    overflow-wrap: anywhere;
  }
`

const Tags = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  @media (max-width: 899px) {
    justify-content: flex-end;
  }
`

const Sub = styled.span`
  color: var(--ink-2);
  font-size: var(--fs-sm);
  @media (max-width: 899px) {
    grid-column: 1 / -1;
  }
`

const Actions = styled.span`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  @media (max-width: 899px) {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
`

const Note = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.65;
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

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

const Mine = styled.p`
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--brand-soft);
  line-height: 1.6;
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

// 승인한 사람: 이름 / 승인한 번호는 있는데 이름이 없으면 탈퇴한 관리자 / 번호도 없으면 첫 관리자
function approvedByText(item) {
  if (item.approvedByName) return item.approvedByName
  if (item.approvedBy !== null && item.approvedBy !== undefined) return '탈퇴한 관리자'
  return '첫 관리자 자동 승인'
}

function AdminAccounts({ onChanged }) {
  const me = useAdminStore((state) => state.admin)
  const showToast = useUiStore((state) => state.showToast)
  const navigate = useNavigate()
  const [filter, setFilter] = useState('PENDING')
  const [result, setResult] = useState({ status: 'loading', items: [] })
  const [attempt, setAttempt] = useState(0)
  // 확인 창: { type: approve / role / reject / remove, item } (null이면 닫힘)
  const [dialog, setDialog] = useState(null)
  const [role, setRole] = useState('MANAGER')
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCancelled = false
    adminApi
      .getAdmins(filter)
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', items: data ?? [] })
      })
      .catch((err) => {
        if (isCancelled) return
        if (err.response?.status === 403) {
          showToast('승인권자만 쓸 수 있는 메뉴예요')
          navigate('/admin', { replace: true })
          return
        }
        if (err.response?.status !== 401) setResult({ status: 'error', items: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [filter, attempt, navigate, showToast])

  const reload = () => {
    setResult({ status: 'loading', items: [] })
    setAttempt((count) => count + 1)
  }

  const openDialog = (type, item) => {
    setError('')
    setRole(type === 'role' ? item.adminRole : 'MANAGER')
    setDialog({ type, item })
  }

  // 요청 공통: 성공 → 알림 + 다시 불러오기 + 메뉴 개수 / 403 → 상품 업데이트로 / 409, 404 → 먼저 처리됨 + 다시 불러오기 / 그 밖 → 서버 문구 (마지막 승인권자 보호 등)
  const run = async (request, doneText) => {
    setError('')
    setIsPending(true)
    try {
      await request()
      setDialog(null)
      showToast(doneText)
      reload()
      onChanged()
    } catch (err) {
      const code = err.response?.status
      if (code === 403) {
        showToast('승인권자만 쓸 수 있는 메뉴예요')
        navigate('/admin', { replace: true })
      } else if (code === 409 || code === 404) {
        setDialog(null)
        showToast(err.response.data?.message ?? '다른 승인권자가 먼저 처리했어요. 목록을 다시 불러와요')
        reload()
        onChanged()
      } else if (code !== 401) {
        const text = err.response?.data?.message ?? '처리하지 못했어요. 다시 시도해 주세요'
        if (dialog) setError(text)
        else showToast(text)
      }
    } finally {
      setIsPending(false)
    }
  }

  const handleConfirm = () => {
    const { type, item } = dialog
    const name = item.adminName
    if (type === 'approve') run(() => adminApi.postAdminApprove(item.adminId, role), `${name} 님을 ${ADMIN_ROLE_LABEL[role]}(으)로 승인했어요`)
    else if (type === 'role') run(() => adminApi.patchAdminRole(item.adminId, role), `${name} 님을 ${ADMIN_ROLE_LABEL[role]}(으)로 바꿨어요`)
    else if (type === 'reject') run(() => adminApi.postAdminReject(item.adminId), '신청을 거절하고 정보를 지웠어요')
    else run(() => adminApi.deleteAdmin(item.adminId), `${name} 님을 관리자에서 해제했어요`)
  }

  const handleUnlock = (item) => run(() => adminApi.postAdminUnlock(item.adminId), `${item.adminName} 잠금을 풀었어요`)

  let body
  if (result.status === 'loading') {
    body = <Status role="status">불러오는 중이에요</Status>
  } else if (result.status === 'error') {
    body = (
      <Status>
        관리자 목록을 불러오지 못했어요
        <Button $size="sm" $variant="outline" onClick={reload}>
          다시 시도
        </Button>
      </Status>
    )
  } else if (result.items.length === 0) {
    body = <Status>{filter === 'PENDING' ? '승인 대기 중인 신청이 없어요' : '정상 관리자가 없어요'}</Status>
  } else {
    body = (
      <List>
        {result.items.map((item) => {
          const isMe = me?.adminId !== undefined && item.adminId === me.adminId
          const isPendingAdmin = item.adminStatus === 'PENDING'
          const isLocked = Boolean(item.lockedUntil)
          return (
            <Row key={item.adminId}>
              <Name>
                <b>
                  {item.adminName}
                  {isMe ? ' (나)' : ''}
                </b>
                <small>{item.adminEmail}</small>
              </Name>
              <Tags>
                {isLocked ? (
                  <Tag $variant="bad">잠김</Tag>
                ) : (
                  <Tag $variant={isPendingAdmin ? 'warn' : 'good'}>{ADMIN_STATUS_LABEL[item.adminStatus] ?? item.adminStatus}</Tag>
                )}
                {item.adminRole && <Tag $variant={item.adminRole === 'APPROVER' ? 'acc' : 'default'}>{ADMIN_ROLE_LABEL[item.adminRole]}</Tag>}
              </Tags>
              <Sub>
                {isPendingAdmin
                  ? `신청 ${formatDateTime(item.requestedAt)}`
                  : `마지막 로그인 ${formatDateTime(item.lastLoginAt)} · 승인 ${approvedByText(item)}`}
              </Sub>
              <Actions>
                {isMe ? (
                  <Button as={Link} to="/admin/me" $size="sm" $variant="outline">
                    내 계정
                  </Button>
                ) : isPendingAdmin ? (
                  <>
                    <Button $size="sm" $variant="outline" onClick={() => openDialog('approve', item)} disabled={isPending}>
                      승인
                    </Button>
                    <Button $size="sm" $variant="outline" onClick={() => openDialog('reject', item)} disabled={isPending}>
                      거절
                    </Button>
                  </>
                ) : (
                  <>
                    <Button $size="sm" $variant="outline" onClick={() => openDialog('role', item)} disabled={isPending}>
                      역할 바꾸기
                    </Button>
                    {isLocked && (
                      <Button $size="sm" $variant="outline" onClick={() => handleUnlock(item)} disabled={isPending}>
                        잠금 풀기
                      </Button>
                    )}
                    <Button $size="sm" $variant="outline" onClick={() => openDialog('remove', item)} disabled={isPending}>
                      해제
                    </Button>
                  </>
                )}
              </Actions>
            </Row>
          )
        })}
      </List>
    )
  }

  const dialogText = dialog ? DIALOG_TEXT[dialog.type] : null
  const hasRoleSelect = dialog?.type === 'approve' || dialog?.type === 'role'

  return (
    <Wrap aria-labelledby="admin-accounts-title">
      <SecHead>
        <h2 id="admin-accounts-title">관리자 계정</h2>
        <p>승인권자만 볼 수 있어요. 가입 신청을 승인하거나 거절하고, 역할 바꾸기 · 잠금 풀기 · 해제를 할 수 있어요.</p>
      </SecHead>
      <ChipGroup options={CHIP_OPTIONS} value={filter} onChange={setFilter} size="sm" label="계정 상태" />
      {body}
      <Note>탈퇴하거나 해제한 관리자는 목록에 나오지 않아요. 그 사람이 남긴 기록은 ‘탈퇴한 관리자’로 보여요. 처리하지 않은 가입 신청은 14일 뒤 자동으로 지워져요.</Note>

      <Modal isOpen={dialog !== null} onClose={() => setDialog(null)} label={dialogText?.title ?? ''} width={480} showClose={false}>
        {dialog !== null && (
          <>
            <DialogTitle>
              {dialog.item.adminName} {dialogText.title}
            </DialogTitle>
            <DialogBody>
              <Hint>
                {dialog.item.adminEmail}
                {dialog.type === 'approve' && ` · 신청 ${formatDateTime(dialog.item.requestedAt)}`}
              </Hint>
              {hasRoleSelect && (
                <>
                  <SelectField label="역할" value={role} onChange={setRole} options={ROLE_OPTIONS} />
                  <Hint>{ROLE_DESC[role]}</Hint>
                </>
              )}
              {dialogText.body && <Mine>{dialogText.body}</Mine>}
              <InlineError>{error}</InlineError>
            </DialogBody>
            <DialogActions>
              <Button $variant="outline" onClick={() => setDialog(null)}>
                취소
              </Button>
              <Button onClick={handleConfirm} disabled={isPending}>
                {dialogText.button}
              </Button>
            </DialogActions>
          </>
        )}
      </Modal>
    </Wrap>
  )
}

export default AdminAccounts
