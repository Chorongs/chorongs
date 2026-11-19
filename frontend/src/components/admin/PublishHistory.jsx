import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { HISTORY_ACTION_TYPE_LABEL } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError, Tag } from '../../styles/common'
import { formatDateTime } from '../../utils/format'
import ChipGroup from '../ui/ChipGroup'
import Modal from '../ui/Modal'
import SectionHeader from '../common/SectionHeader'

// AD-06 반영 이력: 종류 칩 (전체 + 6종) / 최신순 12건 + [더 보기] (E7) / 누가 ('자동' 포함), 언제, 무엇 / '이 시점으로'
// '이 시점으로' → 확인 창 ('이 시점 이후 n건이 취소돼요, 상품 m개가 바뀌어요' + 종료일 지난 상품 안내 + 미처리 신고 안내) → API-36 { historyId, baseVersion } → 다시 불러오기 + 알림
// 되돌리기도 새 이력으로 남음 (이력 안 지움) / 신고 처리, 자동 내림 확인 기록은 되돌리지 않음 (상품 상태만)
// 409 → '다른 작업이 먼저 처리됐어요' + 다시 불러오기 / 연타 방지 (E5) / 0건 → 빈 상태 (관리자 목록 안은 테두리 없는 작은 글씨)
// baseVersion: 현황(API-31)의 현재 버전 (AdminPage가 넘김) / onChanged: 되돌린 뒤 현황 다시 불러오기
// n(취소되는 건수)은 최신순 목록에서 그 줄 위에 있는 건수, m은 서버가 준 값
// TODO(CHORONG-57 BE): API-35 응답 모양({ items, hasMore })과 HistoryResponseDTO 필드 이름(historyId, actionType, actorName, createdAt, summary,
//   canRollback, affectedProductCount, unresolvedReportCount)은 DTO 파일이 올라오면 맞춘다. 종류 코드는 constants/options.js HISTORY_ACTION_TYPE_LABEL
const PAGE_SIZE = 12

const ACTION_VARIANT = {
  INIT: 'default',
  PUBLISH: 'acc',
  AUTO_CLOSE: 'warn',
  HIDE: 'bad',
  UNHIDE: 'good',
  ROLLBACK: 'warn',
}

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const List = styled.ul`
  border-top: 1px solid var(--line);
`

const Item = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
`

const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`

const Meta = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

const Summary = styled.p`
  font-size: var(--fs-md);
  font-weight: 600;
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

const More = styled.div`
  display: flex;
  justify-content: center;
`

const DialogTitle = styled.h2`
  margin-bottom: 12px;
  font-size: var(--fs-h3);
  font-weight: 800;
`

const DialogBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
  color: var(--ink-2);
  font-size: var(--fs-md);
`

const Warn = styled.p`
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--warn-soft);
  color: var(--warn);
  font-weight: 600;
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

const CHIP_OPTIONS = [
  { value: 'ALL', label: '전체' },
  ...Object.entries(HISTORY_ACTION_TYPE_LABEL).map(([value, label]) => ({ value, label })),
]

function PublishHistory({ baseVersion, onChanged }) {
  const showToast = useUiStore((state) => state.showToast)
  const [actionType, setActionType] = useState('ALL')
  // 목록: status loading / error / done, page는 지금까지 받은 마지막 쪽. attempt가 바뀌면 처음부터 다시
  const [result, setResult] = useState({ status: 'loading', items: [], page: 0, hasMore: false })
  const [attempt, setAttempt] = useState(0)
  const [isMoreLoading, setIsMoreLoading] = useState(false)
  // '이 시점으로' 누른 줄 (null이면 확인 창 닫힘)
  const [target, setTarget] = useState(null)
  const [isRolling, setIsRolling] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCancelled = false
    adminApi
      .getVersions({ actionType: actionType === 'ALL' ? undefined : actionType, page: 0, size: PAGE_SIZE })
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', items: data?.items ?? [], page: 0, hasMore: Boolean(data?.hasMore) })
      })
      .catch((err) => {
        if (!isCancelled && err.response?.status !== 401) setResult({ status: 'error', items: [], page: 0, hasMore: false })
      })
    return () => {
      isCancelled = true
    }
  }, [actionType, attempt])

  const reload = () => {
    setResult({ status: 'loading', items: [], page: 0, hasMore: false })
    setAttempt((count) => count + 1)
  }

  const handleMore = async () => {
    setIsMoreLoading(true)
    try {
      const nextPage = result.page + 1
      const data = await adminApi.getVersions({ actionType: actionType === 'ALL' ? undefined : actionType, page: nextPage, size: PAGE_SIZE })
      setResult((prev) => ({ ...prev, items: [...prev.items, ...(data?.items ?? [])], page: nextPage, hasMore: Boolean(data?.hasMore) }))
    } catch (err) {
      if (err.response?.status !== 401) showToast('더 불러오지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsMoreLoading(false)
    }
  }

  const handleRollback = async () => {
    setError('')
    setIsRolling(true)
    try {
      await adminApi.postRollback({ historyId: target.historyId, baseVersion })
      setTarget(null)
      showToast('이 시점으로 되돌렸어요')
      reload()
      onChanged()
    } catch (err) {
      const code = err.response?.status
      if (code === 409) {
        setTarget(null)
        showToast('다른 작업이 먼저 처리됐어요. 목록을 다시 불러와요')
        reload()
        onChanged()
      } else if (code !== 401) {
        setError(err.response?.data?.message ?? '되돌리지 못했어요. 다시 시도해 주세요')
      }
    } finally {
      setIsRolling(false)
    }
  }

  // 확인 창 글: 최신순이라 그 줄 위의 건수가 취소되는 건수
  const cancelCount = target ? result.items.findIndex((item) => item.historyId === target.historyId) : 0

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
        {result.items.map((item) => (
          <Item key={item.historyId}>
            <Body>
              <Meta>
                <Tag $variant={ACTION_VARIANT[item.actionType]}>{HISTORY_ACTION_TYPE_LABEL[item.actionType] ?? item.actionType}</Tag>
                <span>{item.actorName ?? '자동'}</span>
                <span>{formatDateTime(item.createdAt)}</span>
              </Meta>
              <Summary>{item.summary}</Summary>
            </Body>
            {item.canRollback && (
              <Button $size="sm" $variant="outline" onClick={() => setTarget(item)} disabled={isRolling}>
                이 시점으로
              </Button>
            )}
          </Item>
        ))}
      </List>
    )
  }

  return (
    <Wrap>
      <SectionHeader title="반영 이력" description="사이트에 반영한 기록이에요. 이전 시점으로 되돌릴 수 있어요." />
      <ChipGroup options={CHIP_OPTIONS} value={actionType} onChange={setActionType} size="sm" label="종류" />
      {body}
      {result.hasMore && result.status === 'done' && (
        <More>
          <Button $variant="outline" onClick={handleMore} disabled={isMoreLoading}>
            {isMoreLoading ? '불러오는 중' : '더 보기'}
          </Button>
        </More>
      )}

      <Modal isOpen={target !== null} onClose={() => setTarget(null)} label="이 시점으로 되돌리기" width={460} showClose={false}>
        <DialogTitle>이 시점으로 되돌릴까요?</DialogTitle>
        {target !== null && (
          <DialogBody>
            <p>
              이 시점 이후 {cancelCount}건이 취소돼요. 상품 {target.affectedProductCount ?? '-'}개가 바뀌어요.
            </p>
            <p>종료일이 지난 상품은 다음 자동 내림 때 다시 내려가요. 되돌리기도 새 이력으로 남아요.</p>
            {target.unresolvedReportCount > 0 && (
              <Warn>
                미처리 신고 {target.unresolvedReportCount}건이 남아 있어요. 다음 신고가 들어오면 다시 숨겨져요. 신고 상품 관리에서 처리해 주세요.
              </Warn>
            )}
            <InlineError>{error}</InlineError>
          </DialogBody>
        )}
        <DialogActions>
          <Button $variant="outline" onClick={() => setTarget(null)}>
            취소
          </Button>
          <Button onClick={handleRollback} disabled={isRolling}>
            되돌리기
          </Button>
        </DialogActions>
      </Modal>
    </Wrap>
  )
}

export default PublishHistory
