import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { IMPORT_CHANGE_TYPE_LABEL, IMPORT_SOURCE_OPTIONS } from '../../constants/options'
import { Button, InlineError, Tag } from '../../styles/common'
import Checkbox from '../ui/Checkbox'
import ChipGroup from '../ui/ChipGroup'
import Modal from '../ui/Modal'
import SectionHeader from '../common/SectionHeader'

// AD-05 바뀐 상품 확인, 반영 (② 바뀐 내용 확인 후 반영): 구분 칩 (전체 + 구분별 개수) / 바뀐 상품 표 (체크, 구분, 상품명/금융사, 바뀐 내용, 출처) / 반영 바 / 확인 창 / 완료 안내
// job: ①이 끝낸 작업 (ImportStatusResponseDTO, 없으면 안내만). AdminPage가 key={importId}로 그려 작업마다 새로 시작 → 처음 선택 = '확인 필요' 뺀 항목 모두
// '확인 필요'는 선택 불가 + 사유 표시 / 숨긴 상품은 '숨김 중' (반영해도 숨김 유지)
// [사이트에 반영] → 확인 창 → API-34 { itemIds, baseVersion } → 완료 안내 + onPublished() (현황 다시 불러옴. 이력은 그 메뉴를 열 때 새로 불러옴)
// 422 → '확인 필요 항목 빼고 다시' / 409 VERSION_CONFLICT → 다시 불러온 뒤 반영 / 409 CONFLICT → 24시간 지남 / 0건이면 버튼 잠금, 연타 방지 (E5)
// TODO(CHORONG-57 BE): ImportStatusResponseDTO 필드 이름(importId, baseVersion, items[].itemId, changeType, productName, companyName, source,
//   changedFields, reviewReason, hidden)과 구분 코드(constants/options.js IMPORT_CHANGE_TYPE_LABEL), PublishResponseDTO(version)는 DTO 파일이 올라오면 맞춘다
const REVIEW = 'REVIEW'

const CHANGE_TYPE_VARIANT = {
  NEW: 'good',
  CHANGED: 'acc',
  CLOSED: 'warn',
  REOPENED: 'good',
  REVIEW: 'bad',
}

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
  scroll-margin-top: 88px;
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
    vertical-align: top;
  }
  th {
    color: var(--cocoa);
    font-size: var(--fs-sm);
    font-weight: 600;
    white-space: nowrap;
  }
`

const Name = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  b {
    font-weight: 700;
  }
  span {
    color: var(--cocoa);
    font-size: var(--fs-sm);
  }
`

const Reason = styled.p`
  color: var(--bad);
  font-size: var(--fs-sm);
  font-weight: 600;
`

const Changed = styled.p`
  color: var(--ink-2);
  font-size: var(--fs-sm);
`

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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

const Done = styled.p`
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--good-soft);
  color: var(--good);
  font-size: var(--fs-md);
  font-weight: 600;
`

// 관리자 목록 안 빈 상태, 안내: 테두리 없는 작은 글씨
const Status = styled.p`
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

const DialogBody = styled.p`
  margin-bottom: 20px;
  color: var(--ink-2);
  font-size: var(--fs-md);
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

const SOURCE_LABEL = Object.fromEntries(IMPORT_SOURCE_OPTIONS.map((option) => [option.value, option.label]))

function ImportDiff({ job, onPublished }) {
  const wrapRef = useRef(null)
  const items = job?.items ?? []
  const [filter, setFilter] = useState('ALL')
  // 처음 선택: '확인 필요' 뺀 항목 모두 (작업마다 새로 그려지므로 useState 초기값으로)
  const [selectedIds, setSelectedIds] = useState(() =>
    items.filter((item) => item.changeType !== REVIEW).map((item) => item.itemId),
  )
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [error, setError] = useState('')
  const [doneText, setDoneText] = useState('')

  // 작업이 들어오면 ②로 스크롤
  useEffect(() => {
    if (job) wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [job])

  const countOf = (type) => items.filter((item) => item.changeType === type).length
  const chipOptions = [
    { value: 'ALL', label: `전체 ${items.length}` },
    ...Object.entries(IMPORT_CHANGE_TYPE_LABEL).map(([value, label]) => ({ value, label: `${label} ${countOf(value)}` })),
  ]
  const visibleItems = filter === 'ALL' ? items : items.filter((item) => item.changeType === filter)

  const handleToggle = (itemId, checked) => {
    setSelectedIds((prev) => (checked ? [...prev, itemId] : prev.filter((id) => id !== itemId)))
  }

  const handlePublish = async () => {
    setError('')
    setIsPublishing(true)
    try {
      const result = await adminApi.postPublish(job.importId, { itemIds: selectedIds, baseVersion: job.baseVersion })
      setIsConfirmOpen(false)
      setIsPublished(true)
      setDoneText(`${selectedIds.length}건을 사이트에 반영했어요 (버전 ${result?.version ?? '-'})`)
      onPublished()
    } catch (err) {
      const code = err.response?.status
      const errorCode = err.response?.data?.code
      setIsConfirmOpen(false)
      if (code === 422) setError('확인 필요 항목을 빼고 다시 반영해 주세요')
      else if (code === 409 && errorCode === 'VERSION_CONFLICT') setError('다른 작업이 먼저 반영됐어요. 다시 불러온 뒤 반영해 주세요')
      else if (code === 409) setError('불러온 지 24시간이 지났어요. 다시 불러와 주세요')
      else if (code !== 401) setError(err.response?.data?.message ?? '반영하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <Wrap ref={wrapRef} aria-label="바뀐 상품 확인, 반영">
      <SectionHeader title="② 바뀐 상품 확인, 반영" description="바뀐 내용을 확인하고 고른 항목만 사이트에 반영해요." />
      {!job ? (
        <Status>먼저 ①에서 최신 상품을 불러와 주세요</Status>
      ) : (
        <>
          <ChipGroup options={chipOptions} value={filter} onChange={setFilter} size="sm" label="구분" />
          {visibleItems.length === 0 ? (
            <Status>해당하는 바뀐 상품이 없어요</Status>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th>선택</th>
                    <th>구분</th>
                    <th>상품명 / 금융사</th>
                    <th>바뀐 내용</th>
                    <th>출처</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const isReview = item.changeType === REVIEW
                    return (
                      <tr key={item.itemId}>
                        <td>
                          <Checkbox
                            checked={selectedIds.includes(item.itemId)}
                            onChange={(checked) => handleToggle(item.itemId, checked)}
                            label=""
                            isDisabled={isReview || isPublished}
                          />
                        </td>
                        <td>
                          <Tags>
                            <Tag $variant={CHANGE_TYPE_VARIANT[item.changeType]}>
                              {IMPORT_CHANGE_TYPE_LABEL[item.changeType] ?? item.changeType}
                            </Tag>
                            {item.hidden && <Tag>숨김 중</Tag>}
                          </Tags>
                        </td>
                        <td>
                          <Name>
                            <b>{item.productName}</b>
                            <span>{item.companyName}</span>
                          </Name>
                        </td>
                        <td>
                          {isReview ? (
                            <Reason>{item.reviewReason}</Reason>
                          ) : (
                            <Changed>{(item.changedFields ?? []).join(', ') || '-'}</Changed>
                          )}
                        </td>
                        <td>{SOURCE_LABEL[item.source] ?? item.source}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
          <Bar>
            <span>선택 {selectedIds.length}건</span>
            <Button onClick={() => setIsConfirmOpen(true)} disabled={selectedIds.length === 0 || isPublishing || isPublished}>
              사이트에 반영
            </Button>
          </Bar>
          {doneText && <Done role="status">{doneText}</Done>}
          <InlineError>{error}</InlineError>
        </>
      )}

      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} label="사이트에 반영" width={420} showClose={false}>
        <DialogTitle>사이트에 반영할까요?</DialogTitle>
        <DialogBody>고른 {selectedIds.length}건이 바로 사이트에 보여요. 숨긴 상품은 반영해도 숨김이 유지돼요.</DialogBody>
        <DialogActions>
          <Button $variant="outline" onClick={() => setIsConfirmOpen(false)}>
            취소
          </Button>
          <Button onClick={handlePublish} disabled={isPublishing}>
            반영
          </Button>
        </DialogActions>
      </Modal>
    </Wrap>
  )
}

export default ImportDiff
