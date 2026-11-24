import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { AUTO_CLOSED_STATUS_LABEL } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, DialogActions, InlineError, Tag } from '../../styles/common'
import { formatDate, formatDateTime } from '../../utils/format'
import ChipGroup from '../ui/ChipGroup'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'

// AD-11 자동 내림 확인: 칩 (확인 전 (기본) / 확인함 / 다시 게시함) / 선택 바 (전체 선택, n개 선택, [확인 · 판매 종료 유지] [다시 게시]) / 줄 (체크, 상품명·기관, 종료일, 내린 날, 상태)
// 체크는 '확인 전'(checkResult null) 줄에만 (이미 처리한 줄은 서버가 409)
// [확인] → 고른 상품 여러 개 한 번에 → API-48 PATCH { productIds, action: KEEP }
// [다시 게시] → 확인 창 ('종료일을 비우고 다시 게시해요. 다음 불러오기에서 출처 종료일로 다시 채워져요') → API-48 PATCH { action: REOPEN }
// 끝나면 목록 다시 불러옴 + onChanged() (메뉴 개수) / 0건 선택 → 버튼 잠금 / 409 → 서버 문구 ('다른 작업이 먼저 됨') + 다시 불러오기 / 연타 방지 (E5)
// 많으면 [더 보기] (E7, PageInfo 한 쪽 20건) / 0건 → 빈 상태 (관리자 목록 안은 테두리 없는 작은 글씨) / 내림은 매일 06:00 서버가 자동으로
// AutoClosedResponseDTO: productId, productName, companyName, discloseEnd (다시 게시하면 null), closedAt, checkResult (null 확인 전, KEEP, REOPEN)
const MAX_SELECT = 100

const CHIP_OPTIONS = Object.entries(AUTO_CLOSED_STATUS_LABEL).map(([value, label]) => ({ value, label }))

const STATUS_VARIANT = { UNCHECKED: 'bad', KEEP: 'default', REOPEN: 'good' }

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

// 선택 바: 전체 선택 + n개 선택 + 버튼
const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 10px 12px 10px 6px;
  border-radius: var(--r-sm) var(--r-sm) 0 0;
  background: var(--mist);
`

const AllCheck = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-sm);
  font-weight: 700;
  cursor: pointer;
  input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--brand-strong);
  }
`

const BarCount = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  b {
    color: var(--ink);
  }
`

const BarActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
  @media (max-width: 899px) {
    margin-left: 0;
  }
`

// 줄: 체크 | 상품 | 종료일 | 내린 날 | 상태
const List = styled.div`
  border-top: 2px solid var(--ink);
`

const Row = styled.div`
  display: grid;
  grid-template-columns: 24px minmax(0, 1.6fr) 96px 120px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  padding: 16px 6px;
  border-bottom: 1px solid var(--line);
  input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--brand-strong);
  }
  @media (max-width: 899px) {
    grid-template-columns: 24px minmax(0, 1fr) auto;
    gap: 6px 12px;
    padding: 14px 4px;
    > span:first-child {
      grid-row: 1 / 4;
    }
  }
`

const HeadRow = styled(Row)`
  padding: 10px 6px;
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 700;
  @media (max-width: 899px) {
    display: none;
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
  }
`

const Cell = styled.span`
  color: var(--ink-2);
  font-family: var(--f-num);
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
  small {
    display: none;
    color: var(--cocoa);
    font-family: var(--f-ui);
  }
  @media (max-width: 899px) {
    grid-column: 2 / -1;
    small {
      display: inline;
    }
  }
`

const State = styled.span`
  @media (max-width: 899px) {
    grid-column: 3;
    grid-row: 1;
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

const Mine = styled.p`
  margin-bottom: 20px;
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--brand-soft);
  color: var(--ink-2);
  font-size: var(--fs-md);
  line-height: 1.6;
`

const statusOf = (item) => item.checkResult ?? 'UNCHECKED'

function AutoClosedList({ onChanged }) {
  const showToast = useUiStore((state) => state.showToast)
  const [filter, setFilter] = useState('UNCHECKED')
  // 목록: status loading / error / done. page는 지금까지 받은 마지막 쪽 (1부터), hasMore = page * size < total
  const [result, setResult] = useState({ status: 'loading', items: [], page: 1, hasMore: false })
  const [attempt, setAttempt] = useState(0)
  const [isMoreLoading, setIsMoreLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCancelled = false
    adminApi
      .getAutoClosed({ filter, page: 1 })
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
  }, [filter, attempt])

  const reload = () => {
    setResult({ status: 'loading', items: [], page: 1, hasMore: false })
    setSelectedIds([])
    setAttempt((count) => count + 1)
  }

  // 칩을 바꾸면 그 상태만 보이고 선택은 비움
  const handleFilter = (value) => {
    setSelectedIds([])
    setError('')
    setFilter(value)
  }

  const handleMore = async () => {
    setIsMoreLoading(true)
    try {
      const nextPage = result.page + 1
      const data = await adminApi.getAutoClosed({ filter, page: nextPage })
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

  // 체크할 수 있는 줄: 확인 전
  const selectableIds = result.items.filter((item) => statusOf(item) === 'UNCHECKED').map((item) => item.productId)
  const isAllSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))

  const handleToggle = (productId, checked) => {
    setSelectedIds((prev) => (checked ? [...prev, productId] : prev.filter((id) => id !== productId)))
  }

  const handleToggleAll = (checked) => {
    setSelectedIds(checked ? selectableIds.slice(0, MAX_SELECT) : [])
  }

  // action: KEEP 확인 / REOPEN 다시 게시
  const handleAction = async (action) => {
    setError('')
    setIsPending(true)
    try {
      await adminApi.patchAutoClosed({ productIds: selectedIds, action })
      setIsConfirmOpen(false)
      showToast(action === 'KEEP' ? `${selectedIds.length}개를 확인했어요` : `${selectedIds.length}개를 다시 게시했어요. 반영 이력에 남아요`)
      reload()
      onChanged()
    } catch (err) {
      const code = err.response?.status
      setIsConfirmOpen(false)
      if (code === 409) {
        showToast(err.response.data?.message ?? '다른 작업이 먼저 처리됐어요. 목록을 다시 불러와요')
        reload()
        onChanged()
      } else if (code !== 401) {
        setError(err.response?.data?.message ?? '처리하지 못했어요. 다시 시도해 주세요')
      }
    } finally {
      setIsPending(false)
    }
  }

  const hasSelection = selectedIds.length > 0

  let body
  if (result.status === 'loading') {
    body = <Status role="status">불러오는 중이에요</Status>
  } else if (result.status === 'error') {
    body = (
      <Status>
        자동 내림 목록을 불러오지 못했어요
        <Button $size="sm" $variant="outline" onClick={reload}>
          다시 시도
        </Button>
      </Status>
    )
  } else if (result.items.length === 0) {
    body = <Status>이 상태의 상품이 없어요</Status>
  } else {
    body = (
      <>
        {selectableIds.length > 0 && (
          <Bar>
            <AllCheck>
              <input type="checkbox" checked={isAllSelected} onChange={(event) => handleToggleAll(event.target.checked)} />
              전체 선택
            </AllCheck>
            <BarCount>
              {hasSelection ? (
                <>
                  <b>{selectedIds.length}개</b> 선택
                </>
              ) : (
                '확인한 상품을 체크하세요'
              )}
            </BarCount>
            <BarActions>
              <Button $size="sm" $variant="outline" onClick={() => handleAction('KEEP')} disabled={!hasSelection || isPending}>
                <Icon name="check" size={16} />
                확인 · 판매 종료 유지
              </Button>
              <Button $size="sm" onClick={() => setIsConfirmOpen(true)} disabled={!hasSelection || isPending}>
                다시 게시
              </Button>
            </BarActions>
          </Bar>
        )}
        <List role="table" aria-label="자동으로 내려간 상품">
          <HeadRow role="row">
            <span />
            <span role="columnheader">상품</span>
            <span role="columnheader">종료일</span>
            <span role="columnheader">내린 날</span>
            <span role="columnheader">상태</span>
          </HeadRow>
          {result.items.map((item) => {
            const status = statusOf(item)
            const isSelectable = status === 'UNCHECKED'
            return (
              <Row key={item.productId} role="row">
                <span role="cell">
                  {isSelectable && (
                    <input
                      type="checkbox"
                      aria-label={`${item.productName} 선택`}
                      checked={selectedIds.includes(item.productId)}
                      disabled={isPending}
                      onChange={(event) => handleToggle(item.productId, event.target.checked)}
                    />
                  )}
                </span>
                <Name role="cell">
                  <b>{item.productName}</b>
                  <small>{item.companyName}</small>
                </Name>
                <Cell role="cell">
                  <small>종료일 </small>
                  {formatDate(item.discloseEnd)}
                </Cell>
                <Cell role="cell">
                  <small>내린 날 </small>
                  {formatDateTime(item.closedAt)}
                </Cell>
                <State role="cell">
                  <Tag $variant={STATUS_VARIANT[status]}>{AUTO_CLOSED_STATUS_LABEL[status] ?? status}</Tag>
                </State>
              </Row>
            )
          })}
        </List>
      </>
    )
  }

  return (
    <Wrap aria-labelledby="auto-closed-title">
      <SecHead>
        <h2 id="auto-closed-title">자동 내림 확인</h2>
        <p>매일 06:00에 공시 종료일이 지난 상품을 판매 종료로 바꿔요. 확인하고 그대로 두거나, 판매가 계속되면 다시 게시하세요.</p>
      </SecHead>
      <ChipGroup options={CHIP_OPTIONS} value={filter} onChange={handleFilter} size="sm" label="확인 상태" />
      {body}
      {result.hasMore && result.status === 'done' && (
        <More>
          <Button $size="sm" $variant="outline" onClick={handleMore} disabled={isMoreLoading}>
            {isMoreLoading ? '불러오는 중' : '더 보기'}
          </Button>
        </More>
      )}
      <InlineError>{error}</InlineError>

      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} label="다시 게시" width={460} showClose={false}>
        <DialogTitle>{selectedIds.length}개를 다시 게시할까요?</DialogTitle>
        <Mine>
          종료일을 비우고 다시 게시해요. 다음 불러오기에서 출처 종료일로 다시 채워져요. 판매가 계속되는 걸 확인한 경우에만 눌러 주세요.
        </Mine>
        <DialogActions>
          <Button $variant="outline" onClick={() => setIsConfirmOpen(false)}>
            취소
          </Button>
          <Button onClick={() => handleAction('REOPEN')} disabled={isPending}>
            다시 게시
          </Button>
        </DialogActions>
      </Modal>
    </Wrap>
  )
}

export default AutoClosedList
