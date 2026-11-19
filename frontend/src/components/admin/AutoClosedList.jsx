import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { AUTO_CLOSED_STATUS_LABEL } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError, Tag } from '../../styles/common'
import { formatDate } from '../../utils/format'
import Checkbox from '../ui/Checkbox'
import ChipGroup from '../ui/ChipGroup'
import Modal from '../ui/Modal'
import SectionHeader from '../common/SectionHeader'

// AD-11 자동 내림 확인: 칩 (확인 전 (기본) / 확인함 / 다시 게시함) / 목록 (체크, 상품명, 기관, 종료일, 내린 날, 상태) / [확인] [다시 게시]
// [확인] → 고른 상품 여러 개 한 번에 → API-48 PATCH { productIds, action: KEEP }
// [다시 게시] → 확인 창 ('종료일을 비우고 다시 게시해요. 다음 불러오기에서 출처 종료일로 다시 채워져요') → API-48 PATCH { action: REOPEN }
// 끝나면 목록 다시 불러옴 + onChanged() (메뉴 개수) / 0건 선택 → 버튼 잠금 / 409 → '다른 작업이 먼저 처리됨' + 다시 불러오기 / 연타 방지 (E5)
// 많으면 [더 보기] (E7) / 0건 → 빈 상태 (관리자 목록 안은 테두리 없는 작은 글씨) / 내림은 매일 06:00 서버가 자동으로
// TODO(CHORONG-57 BE): API-48 응답 모양({ items, hasMore })과 AutoClosedResponseDTO 필드 이름(productId, productName, companyName, endDate, closedAt, status)은 DTO 파일이 올라오면 맞춘다
const PAGE_SIZE = 20

const CHIP_OPTIONS = Object.entries(AUTO_CLOSED_STATUS_LABEL).map(([value, label]) => ({ value, label }))

const STATUS_VARIANT = { UNCHECKED: 'warn', KEEP: 'default', REOPEN: 'good' }

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

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--mist);
  font-weight: 600;
`

const Buttons = styled.div`
  display: flex;
  gap: 8px;
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

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

function AutoClosedList({ onChanged }) {
  const showToast = useUiStore((state) => state.showToast)
  const [filter, setFilter] = useState('UNCHECKED')
  const [result, setResult] = useState({ status: 'loading', items: [], page: 0, hasMore: false })
  const [attempt, setAttempt] = useState(0)
  const [isMoreLoading, setIsMoreLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCancelled = false
    adminApi
      .getAutoClosed({ filter, page: 0, size: PAGE_SIZE })
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', items: data?.items ?? [], page: 0, hasMore: Boolean(data?.hasMore) })
      })
      .catch((err) => {
        if (!isCancelled && err.response?.status !== 401) setResult({ status: 'error', items: [], page: 0, hasMore: false })
      })
    return () => {
      isCancelled = true
    }
  }, [filter, attempt])

  const reload = () => {
    setResult({ status: 'loading', items: [], page: 0, hasMore: false })
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
      const data = await adminApi.getAutoClosed({ filter, page: nextPage, size: PAGE_SIZE })
      setResult((prev) => ({ ...prev, items: [...prev.items, ...(data?.items ?? [])], page: nextPage, hasMore: Boolean(data?.hasMore) }))
    } catch (err) {
      if (err.response?.status !== 401) showToast('더 불러오지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsMoreLoading(false)
    }
  }

  const handleToggle = (productId, checked) => {
    setSelectedIds((prev) => (checked ? [...prev, productId] : prev.filter((id) => id !== productId)))
  }

  // action: KEEP 확인 / REOPEN 다시 게시
  const handleAction = async (action) => {
    setError('')
    setIsPending(true)
    try {
      await adminApi.patchAutoClosed({ productIds: selectedIds, action })
      setIsConfirmOpen(false)
      showToast(action === 'KEEP' ? `${selectedIds.length}개를 확인했어요` : `${selectedIds.length}개를 다시 게시했어요`)
      reload()
      onChanged()
    } catch (err) {
      const code = err.response?.status
      setIsConfirmOpen(false)
      if (code === 409) {
        showToast('다른 작업이 먼저 처리됐어요. 목록을 다시 불러와요')
        reload()
        onChanged()
      } else if (code !== 401) {
        setError(err.response?.data?.message ?? '처리하지 못했어요. 다시 시도해 주세요')
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
        자동 내림 목록을 불러오지 못했어요
        <Button $size="sm" $variant="outline" onClick={reload}>
          다시 시도
        </Button>
      </Status>
    )
  } else if (result.items.length === 0) {
    body = <Status>{AUTO_CLOSED_STATUS_LABEL[filter]} 상품이 없어요</Status>
  } else {
    body = (
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <th>선택</th>
              <th>상품명</th>
              <th>기관</th>
              <th>종료일</th>
              <th>내린 날</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.productId}>
                <td>
                  <Checkbox
                    checked={selectedIds.includes(item.productId)}
                    onChange={(checked) => handleToggle(item.productId, checked)}
                    label=""
                    isDisabled={isPending}
                  />
                </td>
                <td>
                  <b>{item.productName}</b>
                </td>
                <td>{item.companyName}</td>
                <td>{formatDate(item.endDate)}</td>
                <td>{formatDate(item.closedAt)}</td>
                <td>
                  <Tag $variant={STATUS_VARIANT[item.status]}>{AUTO_CLOSED_STATUS_LABEL[item.status] ?? item.status}</Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    )
  }

  const hasSelection = selectedIds.length > 0

  return (
    <Wrap>
      <SectionHeader title="자동 내림 확인" description="공시가 끝나 매일 06:00에 자동으로 내려간 상품이에요. 확인하거나 다시 게시할 수 있어요." />
      <ChipGroup options={CHIP_OPTIONS} value={filter} onChange={handleFilter} size="sm" label="상태" />
      {body}
      {result.hasMore && result.status === 'done' && (
        <More>
          <Button $variant="outline" onClick={handleMore} disabled={isMoreLoading}>
            {isMoreLoading ? '불러오는 중' : '더 보기'}
          </Button>
        </More>
      )}
      {result.status === 'done' && result.items.length > 0 && (
        <Bar>
          <span>선택 {selectedIds.length}개</span>
          <Buttons>
            <Button $variant="outline" onClick={() => handleAction('KEEP')} disabled={!hasSelection || isPending}>
              확인
            </Button>
            <Button onClick={() => setIsConfirmOpen(true)} disabled={!hasSelection || isPending}>
              다시 게시
            </Button>
          </Buttons>
        </Bar>
      )}
      <InlineError>{error}</InlineError>

      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} label="다시 게시" width={420} showClose={false}>
        <DialogTitle>다시 게시할까요?</DialogTitle>
        <DialogBody>
          <p>고른 {selectedIds.length}개의 종료일을 비우고 다시 게시해요.</p>
          <p>다음 불러오기에서 출처 종료일로 다시 채워져요.</p>
        </DialogBody>
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
