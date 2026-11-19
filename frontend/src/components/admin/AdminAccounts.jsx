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
import SectionHeader from '../common/SectionHeader'

// AD-09 관리자 계정 (승인권자만): 칩 (승인 대기 / 정상) / 목록: 이름, 이메일, 역할, 상태 (승인 대기, 정상, 잠김), 마지막 로그인, 승인한 사람
// [승인] → 역할 고르기 (기본 관리자) → API-46 approve / [거절], [해제] → 확인 창 → API-46 DELETE / [역할 바꾸기] → 역할 고르기 → PATCH / [잠금 풀기] → POST unlock
// 끝나면 목록 다시 불러옴 + 알림 + onChanged() (메뉴 승인 대기 개수) / 내 줄은 버튼 대신 '내 계정으로 이동'
// 403 → 승인권자 아님 안내 후 상품 업데이트로 / 409 → '다른 승인권자가 먼저 처리함' + 다시 불러오기 / 마지막 승인권자 보호 → 서버 문구 / 연타 방지 (E5)
// 탈퇴한 관리자는 목록에 없음 / 잠김은 상태가 아니라 lockedUntil(잠금 해제 시각)이 아직 안 지났으면 (admin 엔티티)
// TODO(CHORONG-57 BE): API-46 목록의 AdminResponseDTO 필드 이름(adminId, adminName, adminEmail, adminRole, adminStatus, lockedUntil, lastLoginAt, approvedByName)은 DTO 파일이 올라오면 맞춘다
const ROLE_OPTIONS = Object.entries(ADMIN_ROLE_LABEL).map(([value, label]) => ({ value, label }))

const CHIP_OPTIONS = Object.entries(ADMIN_STATUS_LABEL).map(([value, label]) => ({ value, label }))

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const TableWrap = styled.div`
  overflow-x: auto;
  border-top: 1px solid var(--line);
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-md);
  th,
  td {
    padding: 12px 8px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    vertical-align: middle;
    white-space: nowrap;
  }
  th {
    color: var(--cocoa);
    font-size: var(--fs-sm);
    font-weight: 600;
  }
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
`

const MeLink = styled(Link)`
  color: var(--brand-text);
  font-size: var(--fs-sm);
  font-weight: 700;
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

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

// 확인 창 종류별 제목, 설명, 버튼 글
const DIALOG_TEXT = {
  approve: { title: '가입을 승인할까요?', button: '승인' },
  role: { title: '역할을 바꿀까요?', button: '바꾸기' },
  reject: { title: '가입 신청을 거절할까요?', body: '거절하면 다시 가입 신청을 해야 해요.', button: '거절' },
  remove: { title: '관리자를 해제할까요?', body: '해제하면 더 이상 관리자로 로그인할 수 없어요.', button: '해제' },
}

function isLocked(item) {
  const until = item.lockedUntil ? Date.parse(item.lockedUntil) : NaN
  return !Number.isNaN(until) && until > Date.now()
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

  // 요청 공통: 성공 → 알림 + 다시 불러오기 + 메뉴 개수 / 403 → 상품 업데이트로 / 409 → 먼저 처리됨 / 그 밖 → 서버 문구 (마지막 승인권자 보호 등)
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
      } else if (code === 409) {
        setDialog(null)
        showToast('다른 승인권자가 먼저 처리했어요. 목록을 다시 불러와요')
        reload()
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
    if (type === 'approve') run(() => adminApi.postAdminApprove(item.adminId, role), `${item.adminName} 님을 승인했어요`)
    else if (type === 'role') run(() => adminApi.patchAdminRole(item.adminId, role), '역할을 바꿨어요')
    else if (type === 'reject') run(() => adminApi.deleteAdmin(item.adminId), '가입 신청을 거절했어요')
    else run(() => adminApi.deleteAdmin(item.adminId), '관리자를 해제했어요')
  }

  const handleUnlock = (item) => run(() => adminApi.postAdminUnlock(item.adminId), '잠금을 풀었어요')

  const statusLabel = (item) => (isLocked(item) ? '잠김' : (ADMIN_STATUS_LABEL[item.adminStatus] ?? item.adminStatus))

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
    body = <Status>{filter === 'PENDING' ? '승인 대기 중인 신청이 없어요' : '관리자가 없어요'}</Status>
  } else {
    body = (
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>역할</th>
              <th>상태</th>
              <th>마지막 로그인</th>
              <th>승인한 사람</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => {
              const isMe = me?.adminId !== undefined && item.adminId === me.adminId
              return (
                <tr key={item.adminId}>
                  <td>
                    <b>{item.adminName}</b>
                  </td>
                  <td>{item.adminEmail}</td>
                  <td>{ADMIN_ROLE_LABEL[item.adminRole] ?? item.adminRole ?? '-'}</td>
                  <td>
                    <Tag $variant={isLocked(item) ? 'bad' : item.adminStatus === 'PENDING' ? 'warn' : 'good'}>{statusLabel(item)}</Tag>
                  </td>
                  <td>{formatDateTime(item.lastLoginAt)}</td>
                  <td>{item.approvedByName ?? '-'}</td>
                  <td>
                    {isMe ? (
                      <Actions>
                        <MeLink to="/admin/me">내 계정으로 이동</MeLink>
                      </Actions>
                    ) : item.adminStatus === 'PENDING' ? (
                      <Actions>
                        <Button $size="sm" onClick={() => openDialog('approve', item)} disabled={isPending}>
                          승인
                        </Button>
                        <Button $size="sm" $variant="outline" onClick={() => openDialog('reject', item)} disabled={isPending}>
                          거절
                        </Button>
                      </Actions>
                    ) : (
                      <Actions>
                        <Button $size="sm" $variant="outline" onClick={() => openDialog('role', item)} disabled={isPending}>
                          역할 바꾸기
                        </Button>
                        {isLocked(item) && (
                          <Button $size="sm" $variant="outline" onClick={() => handleUnlock(item)} disabled={isPending}>
                            잠금 풀기
                          </Button>
                        )}
                        <Button $size="sm" $variant="ghost" onClick={() => openDialog('remove', item)} disabled={isPending}>
                          해제
                        </Button>
                      </Actions>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </TableWrap>
    )
  }

  const dialogText = dialog ? DIALOG_TEXT[dialog.type] : null

  return (
    <Wrap>
      <SectionHeader title="관리자 계정" description="가입 신청을 승인하고 관리자 계정을 관리해요. 승인권자만 쓸 수 있어요." />
      <ChipGroup options={CHIP_OPTIONS} value={filter} onChange={setFilter} size="sm" label="상태" />
      {body}

      <Modal isOpen={dialog !== null} onClose={() => setDialog(null)} label={dialogText?.title ?? ''} width={420} showClose={false}>
        {dialog !== null && (
          <>
            <DialogTitle>{dialogText.title}</DialogTitle>
            <DialogBody>
              <p>
                {dialog.item.adminName} ({dialog.item.adminEmail})
              </p>
              {dialogText.body && <p>{dialogText.body}</p>}
              {(dialog.type === 'approve' || dialog.type === 'role') && (
                <SelectField label="역할" value={role} onChange={setRole} options={ROLE_OPTIONS} />
              )}
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
