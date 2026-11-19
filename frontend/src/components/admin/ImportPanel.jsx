import { useEffect, useState } from 'react'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import { IMPORT_SOURCE_OPTIONS } from '../../constants/options'
import { Button, Card, InlineError } from '../../styles/common'
import { formatNumber } from '../../utils/format'
import Checkbox from '../ui/Checkbox'
import SectionHeader from '../common/SectionHeader'

// AD-04 최신 상품 불러오기 (① 출처 고르고 불러오기): 현황 4칸 (API-31) / 출처 카드 2개 / [최신 상품 불러오기] + 진행 문구
// 불러오기 → API-32 → 1초마다 진행 확인 (API-33, 최대 횟수 안에서) → DONE이면 onDone(작업) → ②(ImportDiff)가 선택, 스크롤
// 출처 0개 → 버튼 잠금 / 409 → '이미 불러오는 중' / FAILED → 실패 문구 + 버튼 다시 열림 / 화면 떠나면 진행 확인 멈춤 (useEffect 정리)
// 이 단계는 사이트 안 바뀜. 매일 자동 수집 없음 (이 버튼으로만 불러옴)
// 현황은 AdminPage가 불러와 props로 (catalog, catalogStatus, onReloadCatalog). 메뉴 개수와 같은 응답
// TODO(CHORONG-57 BE): CatalogResponseDTO(sourceCounts [{ source, count }], currentVersion, autoClosedUncheckedCount),
//   API-32 응답(importId), ImportStatusResponseDTO(status) 필드 이름은 DTO 파일이 올라오면 맞춘다
const POLL_MS = 1000
const MAX_POLL = 300 // 5분
const FAILED_TEXT = '불러오기에 실패했어요. 다시 불러와 주세요'

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Tiles = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 899px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

// 숫자 타일: 안쪽 여백 18px 20px
const Tile = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 20px;
  @media (max-width: 899px) {
    padding: 18px 20px;
  }
`

const TileLabel = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 600;
`

const TileValue = styled.b`
  font-family: var(--f-num);
  font-size: var(--fs-h2);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
`

const Sources = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const Progress = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-md);
  font-weight: 600;
`

// 관리자 목록 안 빈 상태, 안내: 테두리 없는 작은 글씨
const Status = styled.p`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px 0;
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
  const [importId, setImportId] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  const isRunning = jobStatus === 'running'

  // 진행 확인 (API-33): 1초마다, 최대 MAX_POLL번. 앞 요청이 안 끝났으면 그 번은 건너뜀
  useEffect(() => {
    if (!isRunning || importId === null) return undefined
    let count = 0
    let isWaiting = false
    const timer = setInterval(async () => {
      count += 1
      setSeconds(count)
      if (count > MAX_POLL) {
        clearInterval(timer)
        setJobStatus('failed')
        setError('진행 확인 시간이 지났어요. 잠시 뒤 다시 불러와 주세요')
        return
      }
      if (isWaiting) return
      isWaiting = true
      try {
        const job = await adminApi.getImport(importId)
        if (job?.status === 'RUNNING') return
        clearInterval(timer)
        if (job?.status === 'FAILED') {
          setJobStatus('failed')
          setError(FAILED_TEXT)
          return
        }
        setJobStatus('done')
        onDone(job)
      } catch (err) {
        // 401은 axiosInstance가 로그인 화면으로 보냄. 그 밖의 실패는 다음 번에 다시 확인
        if (err.response?.status === 401) clearInterval(timer)
      } finally {
        isWaiting = false
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [isRunning, importId, onDone])

  const handleToggleSource = (value, checked) => {
    setSources((prev) => (checked ? [...prev, value] : prev.filter((item) => item !== value)))
  }

  const handleImport = async () => {
    setError('')
    setSeconds(0)
    setJobStatus('running')
    try {
      const data = await adminApi.postImport(sources)
      setImportId(data?.importId ?? null)
      if (data?.importId === undefined || data?.importId === null) {
        setJobStatus('failed')
        setError(FAILED_TEXT)
      }
    } catch (err) {
      setJobStatus('failed')
      if (err.response?.status === 409) setError('이미 불러오는 중이에요. 끝난 뒤 확인해 주세요')
      else if (err.response?.status !== 401) setError(FAILED_TEXT)
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
            <TileLabel>{option.label} 상품</TileLabel>
            <TileValue>{formatNumber(getSourceCount(catalog, option.value))}</TileValue>
          </Tile>
        ))}
        <Tile>
          <TileLabel>현재 버전</TileLabel>
          <TileValue>{catalog?.currentVersion ?? '-'}</TileValue>
        </Tile>
        <Tile>
          <TileLabel>자동 내림 확인 전</TileLabel>
          <TileValue>{formatNumber(catalog?.autoClosedUncheckedCount)}</TileValue>
        </Tile>
      </Tiles>
    )
  }

  return (
    <Wrap>
      <SectionHeader title="① 최신 상품 불러오기" description="출처를 고르고 불러와요. 이 단계에서는 사이트가 바뀌지 않아요." />
      {tiles}
      <Sources>
        {IMPORT_SOURCE_OPTIONS.map((option) => (
          <Card key={option.value}>
            <Checkbox
              checked={sources.includes(option.value)}
              onChange={(checked) => handleToggleSource(option.value, checked)}
              label={option.label}
              description={`출처 코드 ${option.value}`}
              isDisabled={isRunning}
            />
          </Card>
        ))}
      </Sources>
      <Row>
        <Progress role="status">
          {isRunning && `불러오는 중이에요 (${seconds}초)`}
          {jobStatus === 'done' && '불러왔어요. 아래 ②에서 바뀐 상품을 확인해 주세요'}
        </Progress>
        <Button onClick={handleImport} disabled={sources.length === 0 || isRunning}>
          최신 상품 불러오기
        </Button>
      </Row>
      <InlineError>{error}</InlineError>
    </Wrap>
  )
}

export default ImportPanel
