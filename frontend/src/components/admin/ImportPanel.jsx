import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { IMPORT_SOURCE_OPTIONS } from '../../constants/options'
import { Button, InlineError } from '../../styles/common'
import { formatDateTime, formatNumber } from '../../utils/format'
import Icon from '../ui/Icon'

// AD-04 최신 상품 불러오기 (① 출처 고르고 불러오기): 현황 4칸 (API-31) / 출처 카드 2개 / [최신 상품 불러오기] + 진행 문구
// 열 때 최근 작업 확인 (API-33 latest): RUNNING이면 진행 확인을 이어서, DONE이면 결과를 ②에 넘김, 404나 다른 상태(FAILED, PUBLISHED, EXPIRED)면 평소 화면
// 불러오기 → API-32 (jobId) → 1초마다 진행 확인 (API-33, 최대 횟수 안에서) → DONE이면 onDone(작업) → ②(ImportDiff)가 선택, 스크롤
// 출처 0개 → 버튼 잠금 / 409 → '이미 불러오는 중' / FAILED → 실패 문구 + 버튼 다시 열림 / EXPIRED → 24시간 지남 안내 / 화면 떠나면 진행 확인 멈춤 (useEffect 정리)
// 이 단계는 사이트 안 바뀜. 매일 자동 수집 없음 (이 버튼으로만 불러옴)
// 현황은 AdminPage가 불러와 props로 (catalog, catalogStatus, onReloadCatalog). 메뉴 개수와 같은 응답 (CatalogResponseDTO)
const POLL_MS = 1000
const MAX_POLL = 300 // 5분
const FAILED_TEXT = '불러오기에 실패했어요. 다시 불러와 주세요'
const EXPIRED_TEXT = '불러온 지 24시간이 지났어요. 다시 불러와 주세요'

// 출처 카드 설명 (시안)
const SOURCE_DESC = {
  KINFA: { desc: '대출상품한눈에 · 공공데이터포털', kind: '정책·서민금융' },
  FSS: { desc: '금융상품통합비교공시 오픈 API', kind: '은행·인터넷은행·2금융권' },
}

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

const FetchRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
`

const Progress = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
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
  // 작업: idle 대기 / running 진행 중 / done 끝 / failed 실패
  const [jobStatus, setJobStatus] = useState('idle')
  const [jobId, setJobId] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  const isRunning = jobStatus === 'running'

  // 열 때 최근 작업 (API-33 latest): 진행 중이면 이어서 확인, 비교가 끝났으면 ②에 바로 보여 줌 (새로 고침, 로그아웃 뒤에도 24시간 안 결과를 반영할 수 있음)
  useEffect(() => {
    let isCancelled = false
    adminApi
      .getLatestImport()
      .then((job) => {
        if (isCancelled || !job) return
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
        if (job?.jobStatus === 'DONE') {
          setJobStatus('done')
          onDone(job)
        } else if (job?.jobStatus === 'EXPIRED') {
          setJobStatus('failed')
          setError(EXPIRED_TEXT)
        } else if (job?.jobStatus === 'PUBLISHED') {
          setJobStatus('idle')
          setError('이미 반영된 작업이에요. 필요하면 다시 불러와 주세요')
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

  const handleToggleSource = (value, checked) => {
    setSources((prev) => (checked ? [...prev, value] : prev.filter((item) => item !== value)))
  }

  const handleImport = async () => {
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
      if (err.response?.status === 409) setError(err.response.data?.message ?? '이미 불러오는 중이에요. 끝난 뒤 확인해 주세요')
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
          <em>{catalog?.lastUpdatedAt ? `${formatDateTime(catalog.lastUpdatedAt)} 반영` : '반영 기록 없음'}</em>
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

  let progressText = ''
  if (isRunning) progressText = `최신 상품을 받아와 비교하는 중이에요… (${seconds}초)`
  else if (jobStatus === 'done') progressText = '비교가 끝났어요. 아래 ②에서 바뀐 상품을 확인해 주세요'
  else if (sources.length === 0) progressText = '출처를 하나 이상 골라 주세요'

  return (
    <Wrap>
      {tiles}
      <Section aria-labelledby="import-panel-title">
        <SecHead>
          <No aria-hidden="true">1</No>
          <div>
            <h2 id="import-panel-title">최신 상품 불러오기</h2>
            <p>버튼을 누를 때만 불러와요. 정제 규칙을 적용한 뒤 지금 사이트에 있는 상품과 비교하고, 이 단계에서는 사이트가 바뀌지 않아요.</p>
          </div>
        </SecHead>
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
        <FetchRow>
          <Button onClick={handleImport} disabled={sources.length === 0 || isRunning}>
            <Icon name="refresh" />
            최신 상품 불러오기
          </Button>
          <Progress role="status">{progressText}</Progress>
        </FetchRow>
        <InlineError>{error}</InlineError>
      </Section>
    </Wrap>
  )
}

export default ImportPanel
