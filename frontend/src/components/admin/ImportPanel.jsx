import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { PREPARING_TEXT } from '../../api/axiosInstance'
import { IMPORT_SOURCE_OPTIONS } from '../../constants/options'
import { Button, InlineError, Tag } from '../../styles/common'
import { formatDateTime, formatNumber } from '../../utils/format'
import Icon from '../ui/Icon'

// AD-04 최신 상품 확인, 갱신 (① 최신인지 확인하고, 필요하면 갱신): 현황 4칸 (API-31) / [최신 상품 불러오기] + 확인 결과 카드 / 출처 카드 2개 / [최신 상품 갱신하기] + 진행 문구
// 열 때 최근 작업 확인 (API-33 latest, 외부 API 안 부름): 현황에 '마지막 갱신 finishedAt', RUNNING이면 진행 확인을 이어서, DONE이면 결과를 ②에 넘김, 404나 다른 상태(FAILED, PUBLISHED, EXPIRED)면 평소 화면
// [최신 상품 불러오기] → API-55 (출처마다 첫 쪽만, 몇 초. 적재·비교 안 함) → 출처별 적재 시각, DB·출처 기준값, 최신 여부 + 문구 24 '지금 상품이 최신이에요' / 25 '새 공시·상품이 있어요…' + 반영 전 작업 안내
// [최신 상품 갱신하기] → API-32 (jobId, 이걸 눌렀을 때만 외부 API 전체 수집, 2분 안팎) → 1초마다 진행 확인 (API-33, 최대 횟수 안에서) → DONE이면 onDone(작업) → ②(ImportDiff)가 선택, 스크롤
// 출처 0개 → 갱신 버튼 잠금 / 409 → '이미 갱신하는 중' / FAILED → 실패 문구 + 버튼 다시 열림 / EXPIRED → 24시간 지남 안내 / 화면 떠나면 진행 확인 멈춤 (useEffect 정리)
// 확인 503 → '출처를 확인하지 못했어요…' / 출처 한 곳 실패 → 그 출처만 error 문구 / 서버에 아직 없으면(PREPARING_APIS) '아직 준비 중인 서비스예요'
// 이 단계는 사이트 안 바뀜. 매일 자동 수집 없음 (갱신 버튼으로만)
// 현황은 AdminPage가 불러와 props로 (catalog, catalogStatus, onReloadCatalog). 메뉴 개수와 같은 응답 (CatalogResponseDTO)
const POLL_MS = 1000
const MAX_POLL = 900 // 15분 (금감원 공시 API를 쪽마다 받아 2분 안팎 걸림. 외부 API가 느린 날을 생각해 넉넉히)
const FAILED_TEXT = '갱신에 실패했어요. 다시 갱신해 주세요'
const EXPIRED_TEXT = '갱신한 지 24시간이 지났어요. 다시 갱신해 주세요'
const CHECK_FAILED_TEXT = '출처를 확인하지 못했어요. 잠시 뒤 다시 눌러 주세요'

// 출처 카드 설명 (시안)
const SOURCE_DESC = {
  KINFA: { desc: '대출상품한눈에 · 공공데이터포털', kind: '정책·서민금융', mark: '상품 수' },
  FSS: { desc: '금융상품통합비교공시 오픈 API', kind: '은행·인터넷은행·2금융권', mark: '공시월' },
}

const SOURCE_LABEL = Object.fromEntries(IMPORT_SOURCE_OPTIONS.map((option) => [option.value, option.label]))

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 40px;
`

// 현황 4칸 (시안 adm-stats): 테두리 상자, 작은 이름 + 큰 숫자 + 보조 글
const Tiles = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

const Tile = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  small {
    color: var(--cocoa);
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  b {
    font-family: var(--f-num);
    font-size: var(--fs-h3);
    font-weight: 900;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
  }
  b small {
    margin-left: 2px;
    color: var(--ink-2);
    font-family: var(--f-ui);
    font-size: var(--fs-sm);
  }
  em {
    color: var(--muted);
    font-size: var(--fs-xs);
    font-style: normal;
    font-weight: 600;
  }
`

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

// 구역 제목줄 (시안 adm-sec-h): 번호 동그라미 + 제목(fs-h4) + 설명
const SecHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
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

// 버튼 + 옆 안내 글 한 줄
const ActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
`

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

// 확인 결과 카드: 출처별 한 줄 (이름, 적재 시각, DB·출처 기준값, 최신 딱지)
const CheckCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: var(--r-md);
  border: 1px solid var(--line);
`

const CheckRow = styled.div`
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) auto;
  gap: 8px 16px;
  align-items: center;
  b {
    font-size: var(--fs-base);
    font-weight: 800;
  }
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr) auto;
    > span:nth-child(2) {
      grid-column: 1 / -1;
    }
  }
`

const CheckDetail = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  color: var(--ink-2);
  font-size: var(--fs-sm);
  small {
    color: var(--cocoa);
  }
`

const CheckError = styled.span`
  color: var(--bad);
  font-size: var(--fs-sm);
  font-weight: 600;
`

// 확인 결과 안내 (문구 24, 25): 최신이면 초록, 새 것이 있으면 연주황
const Verdict = styled.p`
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: ${({ $isLatest }) => ($isLatest ? 'var(--good-soft)' : 'var(--brand-soft)')};
  color: ${({ $isLatest }) => ($isLatest ? 'var(--good)' : 'var(--ink-2)')};
  font-size: var(--fs-md);
  font-weight: 600;
  line-height: 1.6;
`

const Sources = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

// 출처 카드 (시안 adm-src): 체크 + 이름 + 설명 + 작은 글. 고르면 테두리 진하게
const SourceCard = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 18px 20px;
  border: 1px solid ${({ $isOn }) => ($isOn ? 'var(--ink-2)' : 'var(--line-2)')};
  border-radius: var(--r-md);
  background: var(--paper);
  box-shadow: ${({ $isOn }) => ($isOn ? 'inset 0 0 0 1px var(--ink-2)' : 'none')};
  cursor: pointer;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
  input {
    flex: none;
    width: 19px;
    height: 19px;
    margin: 2px 0 0;
    accent-color: var(--ink);
  }
  b {
    display: block;
    font-size: var(--fs-base);
    font-weight: 800;
  }
  span span {
    display: block;
    margin-top: 2px;
    color: var(--ink-2);
    font-size: var(--fs-sm);
  }
  small {
    display: block;
    margin-top: 6px;
    color: var(--cocoa);
    font-size: var(--fs-xs);
  }
  &:has(input:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
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

function getSourceCount(catalog, source) {
  return catalog?.sourceCounts?.find((item) => item.source === source)?.count
}

function ImportPanel({ catalog, catalogStatus, onReloadCatalog, onDone }) {
  const [sources, setSources] = useState(IMPORT_SOURCE_OPTIONS.map((option) => option.value))
  // 갱신 작업: idle 대기 / running 진행 중 / done 끝 / failed 실패
  const [jobStatus, setJobStatus] = useState('idle')
  const [jobId, setJobId] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  // 마지막 갱신 시각 (최근 작업의 finishedAt, 현황에 표시)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null)
  // 최신 확인 (API-55): 결과 (null이면 아직 안 누름), 누르는 중, 오류 문구
  const [check, setCheck] = useState(null)
  const [isChecking, setIsChecking] = useState(false)
  const [checkError, setCheckError] = useState('')

  const isRunning = jobStatus === 'running'

  // 열 때 최근 작업 (API-33 latest, 외부 API 안 부름): 마지막 갱신 시각, 진행 중이면 이어서 확인, 비교가 끝났으면 ②에 바로 보여 줌
  useEffect(() => {
    let isCancelled = false
    adminApi
      .getLatestImport()
      .then((job) => {
        if (isCancelled || !job) return
        if (job.finishedAt) setLastRefreshedAt(job.finishedAt)
        if (job.jobStatus === 'RUNNING') {
          setJobId(job.jobId)
          setJobStatus('running')
        } else if (job.jobStatus === 'DONE') {
          setJobStatus('done')
          onDone(job)
        }
      })
      .catch(() => {
        // 작업 없음(404) 등은 평소 화면
      })
    return () => {
      isCancelled = true
    }
  }, [onDone])

  // 진행 확인 (API-33): 1초마다, 최대 MAX_POLL번. 앞 요청이 안 끝났으면 그 번은 건너뜀
  useEffect(() => {
    if (!isRunning || jobId === null) return undefined
    let count = 0
    let isWaiting = false
    const timer = setInterval(async () => {
      count += 1
      setSeconds(count)
      if (count > MAX_POLL) {
        clearInterval(timer)
        setJobStatus('failed')
        setError('진행 확인 시간이 지났어요. 잠시 뒤 화면을 다시 열어 주세요')
        return
      }
      if (isWaiting) return
      isWaiting = true
      try {
        const job = await adminApi.getImport(jobId)
        if (job?.jobStatus === 'RUNNING') return
        clearInterval(timer)
        if (job?.finishedAt) setLastRefreshedAt(job.finishedAt)
        if (job?.jobStatus === 'DONE') {
          setJobStatus('done')
          onDone(job)
        } else if (job?.jobStatus === 'EXPIRED') {
          setJobStatus('failed')
          setError(EXPIRED_TEXT)
        } else if (job?.jobStatus === 'PUBLISHED') {
          setJobStatus('idle')
          setError('이미 반영된 작업이에요. 필요하면 다시 갱신해 주세요')
        } else {
          setJobStatus('failed')
          setError(FAILED_TEXT)
        }
      } catch (err) {
        // 401은 axiosInstance가 로그인 화면으로 보냄. 그 밖의 실패는 다음 번에 다시 확인
        if (err.response?.status === 401) clearInterval(timer)
      } finally {
        isWaiting = false
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [isRunning, jobId, onDone])

  // [최신 상품 불러오기]: 출처 첫 쪽만 확인 (몇 초), 적재 안 함
  const handleCheck = async () => {
    setCheckError('')
    setIsChecking(true)
    try {
      const data = await adminApi.getImportCheck()
      setCheck(data ?? null)
    } catch (err) {
      setCheck(null)
      if (err.isPreparing) setCheckError(PREPARING_TEXT)
      else if (err.response?.status !== 401) setCheckError(err.response?.data?.message ?? CHECK_FAILED_TEXT)
    } finally {
      setIsChecking(false)
    }
  }

  const handleToggleSource = (value, checked) => {
    setSources((prev) => (checked ? [...prev, value] : prev.filter((item) => item !== value)))
  }

  // [최신 상품 갱신하기]: 이걸 눌렀을 때만 외부 API 전체 수집
  const handleRefresh = async () => {
    setError('')
    setSeconds(0)
    setJobStatus('running')
    try {
      const data = await adminApi.postImport(sources)
      if (data?.jobId === undefined || data?.jobId === null) {
        setJobStatus('failed')
        setError(FAILED_TEXT)
        return
      }
      setJobId(data.jobId)
    } catch (err) {
      setJobStatus('failed')
      if (err.response?.status === 409) setError(err.response.data?.message ?? '이미 갱신하는 중이에요. 끝난 뒤 확인해 주세요')
      else if (err.response?.status !== 401) setError(err.response?.data?.message ?? FAILED_TEXT)
    }
  }

  let tiles
  if (catalogStatus === 'loading') {
    tiles = <Status role="status">현황을 불러오는 중이에요</Status>
  } else if (catalogStatus === 'error') {
    tiles = (
      <Status>
        현황을 불러오지 못했어요
        <Button $size="sm" $variant="outline" onClick={onReloadCatalog}>
          다시 시도
        </Button>
      </Status>
    )
  } else {
    tiles = (
      <Tiles>
        {IMPORT_SOURCE_OPTIONS.map((option) => (
          <Tile key={option.value}>
            <small>{option.label} 상품</small>
            <b>
              {formatNumber(getSourceCount(catalog, option.value))}
              <small>개</small>
            </b>
            <em>{SOURCE_DESC[option.value].kind} · 게시 중</em>
          </Tile>
        ))}
        <Tile>
          <small>현재 버전</small>
          <b>{catalog?.currentVersion != null ? `v${catalog.currentVersion}` : '-'}</b>
          <em>
            {lastRefreshedAt
              ? `마지막 갱신 ${formatDateTime(lastRefreshedAt)}`
              : catalog?.lastUpdatedAt
                ? `마지막 반영 ${formatDateTime(catalog.lastUpdatedAt)}`
                : '갱신 기록 없음'}
          </em>
        </Tile>
        <Tile>
          <small>자동 내림 확인 전</small>
          <b>
            {formatNumber(catalog?.autoClosedUncheckedCount)}
            <small>개</small>
          </b>
          <em>매일 06:00 자동으로 내려요</em>
        </Tile>
      </Tiles>
    )
  }

  // 확인 결과 (API-55): 출처별 줄 + 안내 (문구 24, 25) + 반영 전 작업 안내
  let checkResult = null
  if (check) {
    const sourceRows = check.sources ?? []
    const isAllLatest = !check.needsRefresh && sourceRows.every((row) => !row.error)
    checkResult = (
      <CheckCard aria-label="최신 확인 결과">
        {sourceRows.map((row) => (
          <CheckRow key={row.source}>
            <b>{SOURCE_LABEL[row.source] ?? row.source}</b>
            {row.error ? (
              <CheckError>확인하지 못했어요 ({row.error})</CheckError>
            ) : (
              <CheckDetail>
                <span>
                  <small>DB 적재 </small>
                  {formatDateTime(row.loadedAt)}
                </span>
                <span>
                  <small>DB {SOURCE_DESC[row.source]?.mark ?? '기준'} </small>
                  {row.dbMark ?? '-'}
                </span>
                <span>
                  <small>출처 {SOURCE_DESC[row.source]?.mark ?? '기준'} </small>
                  {row.sourceMark ?? '-'}
                </span>
                {row.source === 'KINFA' && (row.newCount > 0 || row.missingCount > 0) && (
                  <span>
                    <small>새로 온 </small>
                    {row.newCount ?? 0}개 <small>빠진 </small>
                    {row.missingCount ?? 0}개
                  </span>
                )}
              </CheckDetail>
            )}
            <span>
              {row.error ? (
                <Tag $variant="bad">확인 실패</Tag>
              ) : row.isLatest ? (
                <Tag $variant="good">최신</Tag>
              ) : (
                <Tag $variant="warn">새 것 있음</Tag>
              )}
            </span>
          </CheckRow>
        ))}
        <Verdict $isLatest={isAllLatest} role="status">
          {isAllLatest ? '지금 상품이 최신이에요' : '새 공시나 상품이 있어요. [최신 상품 갱신하기]를 눌러 주세요'}
          {check.pendingJob && ` 갱신한 결과 ${formatNumber(check.pendingJob.itemCount)}건이 반영을 기다려요 (${formatDateTime(check.pendingJob.finishedAt)} 갱신, 아래 ②)`}
        </Verdict>
        <Hint>확인 시각 {formatDateTime(check.checkedAt)} · 출처마다 첫 쪽만 읽어 비교했어요. 적재는 하지 않아요.</Hint>
      </CheckCard>
    )
  }

  let progressText
  if (isRunning) progressText = `출처에서 다시 받아와 비교하는 중이에요… (${seconds}초, 2분 안팎 걸려요)`
  else if (jobStatus === 'done') progressText = '갱신이 끝났어요. 아래 ②에서 바뀐 상품을 확인해 주세요'
  else if (sources.length === 0) progressText = '출처를 하나 이상 골라 주세요'
  else progressText = '출처에서 다시 받아와요. 2분 안팎 걸려요'

  return (
    <Wrap>
      {tiles}
      <Section aria-labelledby="import-panel-title">
        <SecHead>
          <No aria-hidden="true">1</No>
          <div>
            <h2 id="import-panel-title">최신인지 확인하고, 필요하면 갱신</h2>
            <p>
              [최신 상품 불러오기]는 DB에 적재한 게 언제인지와 출처에 새 공시·상품이 있는지만 확인해요. 새 것이 있으면 [최신 상품 갱신하기]로 받아와요.
              이 단계에서는 사이트가 바뀌지 않아요.
            </p>
          </div>
        </SecHead>
        <ActionRow>
          <Button onClick={handleCheck} disabled={isChecking || isRunning}>
            <Icon name="search" />
            최신 상품 불러오기
          </Button>
          <Hint role="status">{isChecking ? '출처를 확인하는 중이에요…' : '출처 첫 쪽만 읽어요. 몇 초면 끝나요'}</Hint>
        </ActionRow>
        {checkResult}
        <InlineError>{checkError}</InlineError>
        <Sources>
          {IMPORT_SOURCE_OPTIONS.map((option) => {
            const isOn = sources.includes(option.value)
            return (
              <SourceCard key={option.value} $isOn={isOn}>
                <input
                  type="checkbox"
                  checked={isOn}
                  disabled={isRunning}
                  onChange={(event) => handleToggleSource(option.value, event.target.checked)}
                />
                <span>
                  <b>{option.label}</b>
                  <span>{SOURCE_DESC[option.value].desc}</span>
                  <small>
                    {SOURCE_DESC[option.value].kind} · 게시 {formatNumber(getSourceCount(catalog, option.value))}개
                  </small>
                </span>
              </SourceCard>
            )
          })}
        </Sources>
        <ActionRow>
          <Button $variant="outline" onClick={handleRefresh} disabled={sources.length === 0 || isRunning}>
            <Icon name="refresh" />
            최신 상품 갱신하기
          </Button>
          <Hint role="status">{progressText}</Hint>
        </ActionRow>
        <InlineError>{error}</InlineError>
      </Section>
    </Wrap>
  )
}

export default ImportPanel
