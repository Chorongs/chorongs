import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { HISTORY_ACTION_TYPE_LABEL, IMPORT_SOURCE_LABEL } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, DialogActions, InlineError, Tag } from '../../styles/common'
import { formatDateTime } from '../../utils/format'
import ChipGroup from '../ui/ChipGroup'
import Modal from '../ui/Modal'

// AD-06 반영 이력: 종류 칩 (전체 + 6종) / 최신순 12건 + [더 보기] (E7, PageInfo) / v번호, 언제, 종류, 무엇, 누가 ('자동', '탈퇴한 관리자' 포함) / '이 시점으로'
// '이 시점으로' → 되돌리기 미리보기 (API-54) → 확인 창 ('이 시점 이후 n건이 취소돼요, 상품 m개가 바뀌어요' + 종료일 지난 상품 안내 + 미처리 신고 안내)
//   → API-36 { historyId, baseVersion (미리보기 응답 값) } → 다시 불러오기 + 알림 + onChanged() (현황)
// 되돌리기도 새 이력으로 남음 (이력 안 지움) / 신고 처리, 자동 내림 확인 기록은 되돌리지 않음 (상품 상태만)
// 미리보기, 되돌리기 409 CONFLICT → 서버 문구 ('되돌릴 변경이 없어요', 지금 마지막 이력) / 409 VERSION_CONFLICT → '다른 작업이 먼저 됨' + 다시 불러오기 / 404 → 다시 불러오기
// HistoryResponseDTO: historyId (= 버전), adminId (null 자동), adminName (null 탈퇴한 관리자), actionType, targetHistoryId, source, addedCount, changedCount, removedCount, memo, updatedAt, canRollback
const ACTION_VARIANT = { INIT: 'default', PUBLISH: 'acc', AUTO_CLOSE: 'warn', HIDE: 'bad', SHOW: 'good', ROLLBACK: 'default' }

const CHIP_OPTIONS = [{ value: 'ALL', label: '전체' }, ...Object.entries(HISTORY_ACTION_TYPE_LABEL).map(([value, label]) => ({ value, label }))]

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

// 이력 줄: v번호 | 시각 | 종류 + 무엇 + 메모 | 누가 | 이 시점으로
const List = styled.ol`
  border-top: 2px solid var(--ink);
`

const Item = styled.li`
  display: grid;
  grid-template-columns: 52px 112px minmax(0, 1fr) auto auto;
  gap: 12px;
  align-items: center;
  padding: 13px 6px;
  border-bottom: 1px solid var(--line);
  color: var(--ink-2);
  font-size: var(--fs-md);
  @media (max-width: 899px) {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 4px 12px;
  }
`

const Version = styled.b`
  color: var(--ink);
  font-family: var(--f-num);
  font-size: var(--fs-lg);
  font-weight: 700;
  @media (max-width: 899px) {
    grid-row: 1 / span 3;
    align-self: start;
  }
`

const Time = styled.span`
  color: var(--cocoa);
  font-family: var(--f-num);
  font-size: var(--fs-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  @media (max-width: 899px) {
    grid-column: 2;
    grid-row: 1;
  }
`

const What = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  small {
    display: block;
    width: 100%;
    color: var(--cocoa);
    font-size: var(--fs-xs);
  }
  @media (max-width: 899px) {
    grid-column: 2;
    grid-row: 2;
  }
`

const By = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  white-space: nowrap;
  @media (max-width: 899px) {
    grid-column: 2;
    grid-row: 3;
  }
`

const Undo = styled.span`
  display: flex;
  justify-content: flex-end;
  @media (max-width: 899px) {
    grid-column: 3;
    grid-row: 1 / span 3;
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

const More = styled.div`
  display: flex;
  justify-content: center;
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
  b {
    color: var(--ink);
  }
`

const Warn = styled.p`
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--warn-soft);
  color: var(--warn);
  font-weight: 600;
  line-height: 1.6;
`

// 누가: adminId 없으면 '자동', 이름 없으면 '탈퇴한 관리자'
function actorText(item) {
  if (item.adminId === null || item.adminId === undefined) return '자동'
  return item.adminName ?? '탈퇴한 관리자'
}

// 무엇: 종류별 수 글
function whatText(item) {
  const added = item.addedCount ?? 0
  const changed = item.changedCount ?? 0
  const removed = item.removedCount ?? 0
  switch (item.actionType) {
    case 'INIT':
      return `상품 ${added}개`
    case 'PUBLISH':
      return `신규 ${added} · 변경 ${changed} · 판매 중단 ${removed}${item.source ? ` · ${IMPORT_SOURCE_LABEL[item.source] ?? item.source}` : ''}`
    case 'AUTO_CLOSE':
      return `상품 ${removed}개 판매 종료 (공시 종료일 지남)`
    case 'HIDE':
      return `상품 ${changed}개 숨김`
    case 'SHOW':
      return `상품 ${changed}개 다시 보임`
    case 'ROLLBACK':
      return `v${item.targetHistoryId ?? '-'} 시점으로 되돌림 · 상품 ${changed}개`
    default:
      return ''
  }
}

function PublishHistory({ onChanged }) {
  const showToast = useUiStore((state) => state.showToast)
  const [actionType, setActionType] = useState('ALL')
  // 목록: status loading / error / done. page는 지금까지 받은 마지막 쪽 (1부터), hasMore = page * size < total
  const [result, setResult] = useState({ status: 'loading', items: [], page: 1, hasMore: false })
  const [attempt, setAttempt] = useState(0)
  const [isMoreLoading, setIsMoreLoading] = useState(false)
  // '이 시점으로' 누른 뒤 미리보기 결과 { item, preview } (null이면 확인 창 닫힘)
  const [target, setTarget] = useState(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  const params = (page) => ({ actionType: actionType === 'ALL' ? undefined : actionType, page })

  useEffect(() => {
    let isCancelled = false
    adminApi
      .getVersions({ actionType: actionType === 'ALL' ? undefined : actionType, page: 1 })
      .then((data) => {
        if (isCancelled) return
        const list = data?.list ?? []
        setResult({ status: 'done', items: list, page: 1, hasMore: (data?.page ?? 1) * (data?.size ?? list.length) < (data?.total ?? 0) })
      })
      .catch((err) => {
        if (!isCancelled && err.response?.status !== 401) setResult({ status: 'error', items: [], page: 1, hasMore: false })
      })
    return () => {
      isCancelled = true
    }
  }, [actionType, attempt])

  const reload = () => {
    setResult({ status: 'loading', items: [], page: 1, hasMore: false })
    setAttempt((count) => count + 1)
  }

  const handleMore = async () => {
    setIsMoreLoading(true)
    try {
      const nextPage = result.page + 1
      const data = await adminApi.getVersions(params(nextPage))
      const list = data?.list ?? []
      setResult((prev) => ({
        ...prev,
        items: [...prev.items, ...list],
        page: nextPage,
        hasMore: (data?.page ?? nextPage) * (data?.size ?? list.length) < (data?.total ?? 0),
      }))
    } catch (err) {
      if (err.response?.status !== 401) showToast('더 불러오지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsMoreLoading(false)
    }
  }

  // '이 시점으로': 미리보기(API-54)를 받은 뒤 확인 창
  const handlePreview = async (item) => {
    setError('')
    setIsPending(true)
    try {
      const preview = await adminApi.getRollbackPreview(item.historyId)
      setTarget({ item, preview })
    } catch (err) {
      const code = err.response?.status
      if (code === 409 || code === 404) {
        showToast(err.response.data?.message ?? '되돌릴 변경이 없어요. 목록을 다시 불러와요')
        reload()
      } else if (code !== 401) {
        showToast('되돌리기 정보를 불러오지 못했어요. 다시 시도해 주세요')
      }
    } finally {
      setIsPending(false)
    }
  }

  const handleRollback = async () => {
    setError('')
    setIsPending(true)
    try {
      const data = await adminApi.postRollback({ historyId: target.item.historyId, baseVersion: target.preview.baseVersion })
      showToast(`v${target.item.historyId} 시점으로 되돌렸어요 (새 버전 v${data?.version ?? '-'})`)
      setTarget(null)
      reload()
      onChanged()
    } catch (err) {
      const code = err.response?.status
      const errorCode = err.response?.data?.code
      if (code === 409 && errorCode === 'VERSION_CONFLICT') {
        setTarget(null)
        showToast('다른 작업이 먼저 처리됐어요. 목록을 다시 불러와요')
        reload()
        onChanged()
      } else if (code === 409 || code === 404) {
        setTarget(null)
        showToast(err.response.data?.message ?? '되돌릴 변경이 없어요. 목록을 다시 불러와요')
        reload()
      } else if (code !== 401) {
        setError(err.response?.data?.message ?? '되돌리지 못했어요. 다시 시도해 주세요')
      }
    } finally {
      setIsPending(false)
    }
  }

  let body
  if (result.status === 'loading') {
    body = <Status role="status">불러오는 중이에요</Status>
  } else if (result.status === 'error') {
    body = (
      <Status>
        반영 이력을 불러오지 못했어요
        <Button $size="sm" $variant="outline" onClick={reload}>
          다시 시도
        </Button>
      </Status>
    )
  } else if (result.items.length === 0) {
    body = <Status>반영 이력이 없어요</Status>
  } else {
    body = (
      <List>
        {result.items.map((item, index) => (
          <Item key={item.historyId}>
            <Version>v{item.historyId}</Version>
            <Time>{formatDateTime(item.updatedAt)}</Time>
            <What>
              <Tag $variant={ACTION_VARIANT[item.actionType]}>{HISTORY_ACTION_TYPE_LABEL[item.actionType] ?? item.actionType}</Tag>
              <span>{whatText(item)}</span>
              {item.memo && <small>{item.memo}</small>}
            </What>
            <By>{actorText(item)}</By>
            <Undo>
              {item.canRollback ? (
                <Button $size="sm" $variant="outline" onClick={() => handlePreview(item)} disabled={isPending}>
                  이 시점으로
                </Button>
              ) : (
                index === 0 && actionType === 'ALL' && <Tag $variant="good">지금 상태</Tag>
              )}
            </Undo>
          </Item>
        ))}
      </List>
    )
  }

  const preview = target?.preview

  return (
    <Wrap aria-labelledby="publish-history-title">
      <SecHead>
        <h2 id="publish-history-title">반영 이력</h2>
        <p>반영, 자동 내림, 숨기기, 다시 보이기, 되돌리기를 모두 여기에 남겨요. 원하는 시점을 골라 그때 상태로 되돌릴 수 있어요.</p>
      </SecHead>
      <ChipGroup options={CHIP_OPTIONS} value={actionType} onChange={setActionType} size="sm" label="종류" />
      {body}
      {result.hasMore && result.status === 'done' && (
        <More>
          <Button $size="sm" $variant="outline" onClick={handleMore} disabled={isMoreLoading}>
            {isMoreLoading ? '불러오는 중' : '더 보기'}
          </Button>
        </More>
      )}

      <Modal isOpen={target !== null} onClose={() => setTarget(null)} label="이 시점으로 되돌리기" width={480} showClose={false}>
        {target !== null && (
          <>
            <DialogTitle>v{target.item.historyId} 시점으로 되돌릴까요?</DialogTitle>
            <DialogBody>
              <Mine>
                이 시점 이후 <b>{preview.cancelCount ?? 0}건</b>이 취소돼요. 상품 <b>{preview.changedProductCount ?? 0}개</b>가 바뀌어요.
              </Mine>
              <p>종료일이 지난 상품은 다음 자동 내림 때 다시 내려가요. 되돌리기도 새 이력으로 남아요.</p>
              {preview.unhiddenReportCount > 0 && (
                <Warn>
                  미처리 신고 {preview.unhiddenReportCount}건이 남아 있어요. 다음 신고가 들어오면 다시 숨겨져요. 신고 상품 관리에서 처리해 주세요.
                </Warn>
              )}
              <InlineError>{error}</InlineError>
            </DialogBody>
            <DialogActions>
              <Button $variant="outline" onClick={() => setTarget(null)}>
                취소
              </Button>
              <Button onClick={handleRollback} disabled={isPending}>
                되돌리기
              </Button>
            </DialogActions>
          </>
        )}
      </Modal>
    </Wrap>
  )
}

export default PublishHistory
