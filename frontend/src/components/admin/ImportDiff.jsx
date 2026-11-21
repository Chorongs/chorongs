import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { CHECK_REASON_LABEL, IMPORT_CHANGE_TYPE_LABEL, IMPORT_SOURCE_OPTIONS } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, InlineError, Tag } from '../../styles/common'
import ChipGroup from '../ui/ChipGroup'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'

// AD-05 바뀐 상품 확인, 반영 (② 바뀐 내용 확인 후 반영)
// job: ①에서 [최신 상품 불러오기]로 DB에서 읽은 작업 (ImportStatusResponseDTO, jobStatus DONE. 없으면 안내만). AdminPage가 key={jobId}로 그려 작업마다 새로 시작
//   → 처음 선택 = '확인 필요'(CHECK) 뺀 항목 모두
// 보이는 것: 출처별 결과 한 줄 / 구분 칩 (전체 + 구분별 개수) / 표 (전체 선택, 구분, 상품명·금융사, 바뀐 내용, 출처) / 반영 바 (선택 n건 + 구분별 수) / 확인 창 / 완료 상자
// '확인 필요'는 사유(checkReasons) 표시 + 선택 불가 / '바뀐 내용'은 바뀐 칸 이름(changedFields, DB 칼럼 이름 그대로) / 숨긴 상품(hiddenYn Y)은 '숨김 중'
// [사이트에 반영] → 확인 창 → API-34 { itemIds, baseVersion (작업의 baseVersion 그대로) } → 완료 상자 + onPublished() (현황 다시 불러옴. 이력은 그 메뉴를 열 때 새로 불러옴)
// 422 → '확인 필요 항목 빼고 다시' / 409 VERSION_CONFLICT → 다시 갱신하고 불러온 뒤 반영 / 409 CONFLICT → 서버 문구 (24시간 지남) / 0건이면 버튼 잠금, 연타 방지 (E5)
// 기준 버전(baseVersion)이 없는 작업(상품 첫 적재 INIT 전에 갱신한 결과)은 ①이 걸러 넘기지 않음. 혹시 받아도 목록 대신 안내만 (서버에 보내면 400)
const NO_BASE_VERSION_TEXT =
  '기준 버전이 없는 결과라 반영할 수 없어요 (상품 첫 적재 전에 갱신한 결과). 첫 적재를 한 뒤 ①에서 [최신 상품 갱신하기]로 다시 비교하고 불러와 주세요'
const CHECK = 'CHECK'

const CHANGE_TYPE_VARIANT = { NEW: 'good', CHANGE: 'acc', REMOVE: 'default', REOPEN: 'good', CHECK: 'bad' }

// 반영 바, 확인 창의 구분별 수 순서
const COUNT_TYPES = ['NEW', 'CHANGE', 'REOPEN', 'REMOVE']

const SOURCE_LABEL = Object.fromEntries(IMPORT_SOURCE_OPTIONS.map((option) => [option.value, option.label]))

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-margin-top: 88px;
`

const SecHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
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

const No = styled.span`
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--f-num);
  font-size: var(--fs-base);
  font-weight: 900;
`

const Meta = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
  b {
    color: var(--ink-2);
  }
`

const SourceFail = styled.p`
  color: var(--bad);
  font-size: var(--fs-sm);
  font-weight: 600;
`

// 표 (시안 adm-list, adm-row): 위 2px 검은 선, 줄마다 1px 구분선. 900px 미만은 체크 | 상품 | 구분 → 아래로 바뀐 내용, 출처
const List = styled.div`
  border-top: 2px solid var(--ink);
`

const Row = styled.div`
  display: grid;
  grid-template-columns: 24px 82px minmax(0, 1fr) minmax(0, 1.5fr) 104px;
  gap: 16px;
  align-items: start;
  padding: 16px 6px;
  border-bottom: 1px solid var(--line);
  ${({ $isBad }) =>
    $isBad &&
    `
    margin: 6px 0;
    border-radius: var(--r-sm);
    border-bottom-color: transparent;
    background: var(--bad-soft);
  `}
  input {
    width: 18px;
    height: 18px;
    margin: 4px 0 0;
    accent-color: var(--brand-strong);
  }
  @media (max-width: 899px) {
    grid-template-columns: 22px minmax(0, 1fr) auto;
    gap: 6px 12px;
    padding: 14px 4px;
  }
`

const HeadRow = styled(Row)`
  align-items: center;
  padding: 10px 6px;
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 700;
  input {
    margin: 0;
  }
  @media (max-width: 899px) {
    grid-template-columns: 22px minmax(0, 1fr);
    > span:nth-child(n + 3) {
      display: none;
    }
  }
`

const Type = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  @media (max-width: 899px) {
    grid-column: 3;
    grid-row: 1;
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
  @media (max-width: 899px) {
    grid-column: 2;
    grid-row: 1;
  }
`

const Changes = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  li {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    align-items: center;
    line-height: 1.5;
  }
  li > span:first-child {
    min-width: 78px;
    color: var(--cocoa);
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  code {
    font-family: var(--f-num);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--ink);
  }
  @media (max-width: 899px) {
    grid-column: 2 / -1;
    grid-row: 2;
    li > span:first-child {
      min-width: 0;
    }
  }
`

const Reason = styled.li`
  && {
    flex-wrap: nowrap;
    align-items: flex-start;
    color: var(--bad);
    font-weight: 700;
  }
  && > span:first-child {
    flex: none;
    min-width: 0;
    margin-top: 3px;
    color: var(--bad);
  }
`

const Source = styled.span`
  color: var(--ink-2);
  font-size: var(--fs-sm);
  font-weight: 600;
  @media (max-width: 899px) {
    grid-column: 2 / -1;
    grid-row: 3;
    color: var(--cocoa);
    font-size: var(--fs-xs);
  }
`

// 반영 바 (시안 adm-bar): 아래에 붙는 검은 바 + 주 버튼
const Bar = styled.div`
  position: sticky;
  bottom: 16px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
  padding: 12px 12px 12px 22px;
  border-radius: var(--r-md);
  background: var(--ink);
  color: var(--paper);
  box-shadow: var(--shadow-pop);
  b {
    margin-right: 8px;
    font-size: var(--fs-lg);
    font-weight: 800;
  }
  span {
    font-size: var(--fs-sm);
    opacity: 0.8;
  }
  @media (max-width: 899px) {
    bottom: calc(66px + 12px + env(safe-area-inset-bottom));
    padding: 12px 12px 12px 16px;
    button {
      flex: 1 1 auto;
    }
  }
`

// 완료 상자 (시안 adm-done)
const Done = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 22px;
  border-radius: var(--r-md);
  background: var(--good-soft);
  color: var(--ink-2);
  font-size: var(--fs-md);
  > span {
    flex: none;
    color: var(--good);
  }
  b {
    color: var(--ink);
    font-size: var(--fs-lg);
  }
  p {
    margin-top: 2px;
  }
`

const DoneLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
`

// 빈 상태 (시안 empty): 점선 상자 + 아이콘
const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 36px 20px;
  border: 1px dashed var(--line-2);
  border-radius: var(--r-md);
  color: var(--cocoa);
  font-size: var(--fs-md);
  text-align: center;
`

const DialogTitle = styled.h2`
  margin-bottom: 16px;
  font-size: var(--fs-h3);
  font-weight: 800;
`

// 확인 창 숫자 4칸 (시안 sheet-nums n4)
const Nums = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px;
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: var(--r-md);
  background: var(--line);
  > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 16px 18px;
    background: var(--mist);
  }
  small {
    color: var(--cocoa);
    font-size: var(--fs-xs);
    font-weight: 700;
  }
  b {
    font-family: var(--f-num);
    font-size: var(--fs-xl);
    font-weight: 900;
    white-space: nowrap;
  }
  b small {
    margin-left: 2px;
    color: inherit;
    font-family: var(--f-ui);
    font-weight: 800;
  }
  @media (max-width: 899px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

// 구분별 수 글: '신규 a · 변경 b · 다시 게시 c · 판매 중단 d'
function countText(items) {
  return COUNT_TYPES.map((type) => `${IMPORT_CHANGE_TYPE_LABEL[type]} ${items.filter((item) => item.diffType === type).length}`).join(' · ')
}

// 바뀐 내용 칸: 구분마다 설명 줄 + 바뀐 칸 이름 + 숨김 안내 + 확인 필요 사유
function ChangeLines({ item }) {
  const fields = item.changedFields ?? []
  const lines = []
  if (item.diffType === 'NEW') lines.push(['새 상품', '반영하면 사이트에 바로 보여요'])
  if (item.diffType === 'REMOVE') {
    lines.push([null, '출처 목록에서 빠졌어요. 반영하면 판매 종료로 바뀌고, 찜 · 최근 본 · 비교 내역에는 ‘판매 종료’ 딱지로 남아요'])
  }
  if (fields.length > 0 && item.diffType !== 'NEW') {
    lines.push(['바뀐 칸', fields.map((field) => <code key={field}>{field}</code>)])
  }
  if (item.diffType === 'REOPEN') lines.push([null, '판매 종료된 상품이 다시 왔어요. 반영하면 다시 게시해요'])
  if (item.hiddenYn === 'Y' && item.diffType !== 'REMOVE') lines.push([null, '숨긴 상품이라 반영해도 숨김을 유지해요'])

  return (
    <Changes>
      {lines.map(([label, body], index) => (
        <li key={index}>
          {label && <span>{label}</span>}
          {Array.isArray(body) ? body : <span>{body}</span>}
        </li>
      ))}
      {(item.checkReasons ?? []).map((reason) => (
        <Reason key={reason}>
          <span>
            <Icon name="alert" size={14} />
          </span>
          <span>{CHECK_REASON_LABEL[reason] ?? reason}. 반영할 수 없으니 원본 데이터를 확인하세요</span>
        </Reason>
      ))}
    </Changes>
  )
}

function ImportDiff({ job, onPublished }) {
  const wrapRef = useRef(null)
  const showToast = useUiStore((state) => state.showToast)
  const items = job?.items ?? []
  const [filter, setFilter] = useState('ALL')
  // 처음 선택: '확인 필요' 뺀 항목 모두 (작업마다 새로 그려지므로 useState 초기값으로)
  const [selectedIds, setSelectedIds] = useState(() =>
    items.filter((item) => item.diffType !== CHECK).map((item) => item.itemId),
  )
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  // 반영 결과 { version, count } (있으면 표 대신 완료 상자)
  const [published, setPublished] = useState(null)
  const [error, setError] = useState('')

  // 작업이 들어오면 ②로 스크롤
  useEffect(() => {
    if (job) wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [job])

  const countOf = (type) => items.filter((item) => item.diffType === type).length
  const chipOptions = [
    { value: 'ALL', label: `전체 ${items.length}` },
    ...Object.entries(IMPORT_CHANGE_TYPE_LABEL).map(([value, label]) => ({ value, label: `${label} ${countOf(value)}` })),
  ]
  const visibleItems = filter === 'ALL' ? items : items.filter((item) => item.diffType === filter)
  const visibleValidIds = visibleItems.filter((item) => item.diffType !== CHECK).map((item) => item.itemId)
  const isAllVisibleSelected = visibleValidIds.length > 0 && visibleValidIds.every((id) => selectedIds.includes(id))
  const selectedItems = items.filter((item) => selectedIds.includes(item.itemId))
  const hasBaseVersion = job?.baseVersion !== null && job?.baseVersion !== undefined

  const handleToggle = (itemId, checked) => {
    setSelectedIds((prev) => (checked ? [...prev, itemId] : prev.filter((id) => id !== itemId)))
  }

  // 보이는 항목 중 반영할 수 있는 것 모두 선택 / 해제
  const handleToggleAll = (checked) => {
    setSelectedIds((prev) =>
      checked ? [...new Set([...prev, ...visibleValidIds])] : prev.filter((id) => !visibleValidIds.includes(id)),
    )
  }

  const handlePublish = async () => {
    setError('')
    setIsPublishing(true)
    try {
      const result = await adminApi.postPublish(job.jobId, { itemIds: selectedIds, baseVersion: job.baseVersion })
      setIsConfirmOpen(false)
      setPublished({ version: result?.version ?? '-', count: selectedItems.length, text: countText(selectedItems) })
      showToast(`v${result?.version ?? '-'}로 반영했어요. 사용자 화면에 바로 보여요`)
      onPublished()
    } catch (err) {
      const code = err.response?.status
      const errorCode = err.response?.data?.code
      setIsConfirmOpen(false)
      if (code === 422) setError('확인 필요 항목을 빼고 다시 반영해 주세요')
      else if (code === 409 && errorCode === 'VERSION_CONFLICT') setError('다른 작업이 먼저 반영됐어요. ①에서 다시 갱신하고 불러온 뒤 반영해 주세요')
      else if (code === 409) setError(err.response.data?.message ?? '갱신한 지 24시간이 지났어요. 다시 갱신해 주세요')
      else if (code !== 401) setError(err.response?.data?.message ?? '반영하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPublishing(false)
    }
  }

  const sourceResults = job?.sourceResults ?? []
  const okResults = sourceResults.filter((result) => result.success)
  const failResults = sourceResults.filter((result) => !result.success)

  let body
  if (!job) {
    body = (
      <Empty>
        <Icon name="refresh" size={24} />① [최신 상품 불러오기]를 누르면 적재된 바뀐 상품이 여기에 나와요
      </Empty>
    )
  } else if (!hasBaseVersion) {
    body = <Empty>{NO_BASE_VERSION_TEXT}</Empty>
  } else if (published) {
    body = (
      <Done role="status">
        <Icon name="check" size={24} />
        <div>
          <b>v{published.version}로 반영했어요</b>
          <p>
            {published.count}건이 사용자 화면에 바로 반영됐어요 ({published.text})
          </p>
          <DoneLinks>
            <Button as={Link} to="/ranking" $variant="outline" $size="sm">
              대출 랭킹에서 확인
              <Icon name="arrow" size={13} />
            </Button>
            <Button as={Link} to="/search" $variant="outline" $size="sm">
              상품 찾기에서 확인
              <Icon name="arrow" size={13} />
            </Button>
          </DoneLinks>
        </div>
      </Done>
    )
  } else if (items.length === 0) {
    body = (
      <>
        <Meta>
          {okResults.map((result) => `${SOURCE_LABEL[result.source] ?? result.source} ${result.count ?? 0}개`).join(' · ')}를 비교했어요
        </Meta>
        <Empty>
          <Icon name="check" size={24} />
          바뀐 상품이 없어요. 사이트가 최신 상태예요
        </Empty>
      </>
    )
  } else {
    body = (
      <>
        <Meta>
          {okResults.map((result) => `${SOURCE_LABEL[result.source] ?? result.source} ${result.count ?? 0}개`).join(' · ')}를 비교했어요. 바뀐 상품{' '}
          <b>{items.length}개</b>
        </Meta>
        {failResults.map((result) => (
          <SourceFail key={result.source}>
            {SOURCE_LABEL[result.source] ?? result.source}: 불러오지 못했어요{result.error ? ` (${result.error})` : ''}
          </SourceFail>
        ))}
        <ChipGroup options={chipOptions} value={filter} onChange={setFilter} size="sm" label="구분별로 보기" />
        <List role="table" aria-label="바뀐 상품">
          <HeadRow role="row">
            <span role="columnheader">
              <input
                type="checkbox"
                aria-label="반영할 수 있는 항목 모두 선택"
                checked={isAllVisibleSelected}
                disabled={visibleValidIds.length === 0}
                onChange={(event) => handleToggleAll(event.target.checked)}
              />
            </span>
            <span role="columnheader">구분</span>
            <span role="columnheader">상품</span>
            <span role="columnheader">바뀐 내용</span>
            <span role="columnheader">출처</span>
          </HeadRow>
          {visibleItems.length === 0 && <Empty>해당하는 바뀐 상품이 없어요</Empty>}
          {visibleItems.map((item) => {
            const isCheck = item.diffType === CHECK
            return (
              <Row key={item.itemId} role="row" $isBad={isCheck}>
                <span role="cell">
                  <input
                    type="checkbox"
                    aria-label={`${item.productName ?? '상품'} 반영`}
                    checked={selectedIds.includes(item.itemId)}
                    disabled={isCheck}
                    onChange={(event) => handleToggle(item.itemId, event.target.checked)}
                  />
                </span>
                <Type role="cell">
                  <Tag $variant={CHANGE_TYPE_VARIANT[item.diffType]}>{IMPORT_CHANGE_TYPE_LABEL[item.diffType] ?? item.diffType}</Tag>
                  {item.hiddenYn === 'Y' && <Tag $variant="warn">숨김 중</Tag>}
                </Type>
                <Name role="cell">
                  <b>{item.productName || '(상품명 없음)'}</b>
                  <small>{item.companyName || '(기관 없음)'}</small>
                </Name>
                <ChangeLines item={item} />
                <Source role="cell">{SOURCE_LABEL[item.source] ?? item.source}</Source>
              </Row>
            )
          })}
        </List>
        <Bar>
          <div>
            <b>선택 {selectedItems.length}건</b>
            <span>{countText(selectedItems)}</span>
          </div>
          <Button onClick={() => setIsConfirmOpen(true)} disabled={selectedItems.length === 0 || isPublishing}>
            사이트에 반영
          </Button>
        </Bar>
      </>
    )
  }

  return (
    <Wrap ref={wrapRef} aria-labelledby="import-diff-title">
      <SecHead>
        <No aria-hidden="true">2</No>
        <div>
          <h2 id="import-diff-title">확인 후 사이트에 반영</h2>
          <p>바뀐 내용을 확인하고 반영할 항목만 고르세요. ‘확인 필요’ 항목은 원본 데이터를 고칠 때까지 반영할 수 없어요.</p>
        </div>
      </SecHead>
      {body}
      <InlineError>{error}</InlineError>

      <Modal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} label="사이트에 반영" width={520} showClose={false}>
        <DialogTitle>{selectedItems.length}건을 사이트에 반영할까요?</DialogTitle>
        <Nums>
          {COUNT_TYPES.map((type) => (
            <div key={type}>
              <small>{IMPORT_CHANGE_TYPE_LABEL[type]}</small>
              <b>
                {selectedItems.filter((item) => item.diffType === type).length}
                <small>건</small>
              </b>
            </div>
          ))}
        </Nums>
        <Mine>
          반영하면 상품 찾기 · 대출 랭킹 · 추천 결과에 바로 나타나요. 판매 중단 상품은 사이트에서 내려가고, 찜 · 최근 본 · 비교 내역에는
          ‘판매 종료’ 딱지로 남아요. 숨긴 상품은 값만 바뀌고 숨김을 유지해요. 반영한 뒤에도 ‘반영 이력’에서 되돌릴 수 있어요.
        </Mine>
        <DialogActions>
          <Button $variant="outline" onClick={() => setIsConfirmOpen(false)}>
            취소
          </Button>
          <Button onClick={handlePublish} disabled={isPublishing}>
            반영하기
          </Button>
        </DialogActions>
      </Modal>
    </Wrap>
  )
}

export default ImportDiff
