import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { getRankings } from '../api/productApi'
import BaseDateBadge from '../components/common/BaseDateBadge'
import PageHeader from '../components/common/PageHeader'
import RankingItem from '../components/ranking/RankingItem'
import SelectField from '../components/ui/SelectField'
import {
  RANKING_CAT_OPTIONS,
  RANKING_DEFAULT_DIR,
  RANKING_MAX,
  RANKING_METRIC_OPTIONS,
  getRankingDirOptions,
  getRankingHint,
  readRankingParams,
} from '../constants/options'
import { Button, EmptyBox } from '../styles/common'

// RK-01 대출 랭킹 화면 (SCR-05, 가안 #p-ranking): 기준 탭 (금리순, 한도순, 기간순, 인기순) / 필터: 금융권 + 순서 / 결과 머리 / 순위 목록 (최대 30)
// 조건은 주소(?cat=&metric=&dir=)에 남김 (useSearchParams). 주소 값은 누구나 바꿀 수 있어서 정해진 값인지 검사하고, 이상하면 기본값 (readRankingParams)
//   - 기본값: 금리순, 낮은 순, 금융권 전체 (주소에 값이 없으면 이 값으로 열림 = 상단 메뉴 하위 메뉴(LY-05)의 ?metric=만 있는 주소도 그 탭으로 열림)
//   - 기준 탭을 바꾸면 금융권(cat)은 그대로, 순서(dir)는 그 기준 기본값 (금리순 낮은 순, 나머지 높은 순)
// 기준 탭은 주소의 ?뒤 값으로 현재 탭을 정해서 CM-03 RouteTabs(NavLink는 주소 경로만 봄)를 쓰지 않고, 같은 모양의 탭을 이 파일에 둠
// 조건이 바뀔 때마다 getRankings (API-04)를 다시 부르고, 받는 동안 이전 결과를 그대로 보여 줌 (비우지 않음)
// 실패는 목록 구역만 짧은 문구 + [다시 시도] (E3, 서버 글 그대로 출력 금지) / 0건은 빈 상태 상자 (E11, 목록과 같은 자리)
// 목록은 서버 순서 그대로 최대 30개. 쪽 넘김, [더 보기]는 없음
const CAT_SELECT_OPTIONS = RANKING_CAT_OPTIONS.map((name) => ({
  value: name === '전체' ? '' : name,
  label: name === '전체' ? '금융권 전체' : name,
}))
const ALL_CAT_TITLE = '금융권 전체'

// 기준 탭: 가안 .tabs (밑줄 탭) 모양
const Tabs = styled.div.attrs({ role: 'tablist' })`
  display: flex;
  gap: 28px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
  @media (max-width: 899px) {
    gap: 20px;
  }
`

const Tab = styled.button.attrs({ type: 'button', role: 'tab' })`
  position: relative;
  padding: 4px 0 14px;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: var(--fs-xl);
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  &:hover {
    color: var(--ink);
  }
  &[aria-selected='true'] {
    color: var(--ink);
    font-weight: 800;
  }
  &[aria-selected='true']::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: -1px;
    left: 0;
    height: 3px;
    border-radius: 3px;
    background: var(--ink);
  }
`

const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 28px;
`

const CatBox = styled.div`
  min-width: 150px;
`

// 순서 버튼 묶음: 오른쪽 끝, 작은 버튼 2개 (가안 .rk-dir)
const DirGroup = styled.div.attrs({ role: 'group', 'aria-label': '순서' })`
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-left: auto;
  border-radius: var(--r-sm);
  background: var(--mist);
`

const DirButton = styled.button.attrs({ type: 'button' })`
  padding: 6px 12px;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
  cursor: pointer;
  &[aria-pressed='true'] {
    background: var(--paper);
    color: var(--ink);
    box-shadow: var(--shadow-1);
  }
`

// 결과 머리 (가안 .rk-head): 왼쪽에 금융권 이름 + 개수 + 안내, 오른쪽 끝에 기준일
const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 12px;
`

const Title = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
`

const TitleText = styled.h2`
  font-size: var(--fs-h3);
  font-weight: 800;
`

const Count = styled.em`
  color: var(--good);
  font-family: var(--f-num);
  font-size: var(--fs-h4);
  font-style: normal;
  font-weight: 900;
`

const Hint = styled.span`
  margin-left: 4px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const List = styled.div`
  border-top: 1px solid var(--line);
`

const Status = styled(EmptyBox)`
  margin-top: 12px;
`

function RankingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { cat, metric, dir } = readRankingParams({
    cat: searchParams.get('cat'),
    metric: searchParams.get('metric'),
    dir: searchParams.get('dir'),
  })

  // 바꾼 조건을 주소에 남김 (전체는 cat을 적지 않음)
  const writeParams = (next) => {
    const merged = { cat, metric, dir, ...next }
    const params = { metric: merged.metric, dir: merged.dir }
    if (merged.cat) params.cat = merged.cat
    setSearchParams(params)
  }
  const handleMetricChange = (value) => writeParams({ metric: value, dir: RANKING_DEFAULT_DIR[value] })
  const handleCatChange = (value) => writeParams({ cat: value })
  const handleDirChange = (value) => writeParams({ dir: value })

  const [attempt, setAttempt] = useState(0)
  const requestKey = JSON.stringify({ cat, metric, dir, attempt })
  // 이 결과를 받을 때의 조건(cat, metric, dir)도 같이 담음: 새로 받는 동안 이전 결과의 기준 값 모양과 머리 글을 유지하려고
  const [result, setResult] = useState({ key: '', status: 'loading', cat, metric, dir, items: [], baseDate: null })
  useEffect(() => {
    const query = JSON.parse(requestKey)
    const { cat: nextCat, metric: nextMetric, dir: nextDir } = query
    let isCancelled = false
    getRankings({ cat: nextCat, metric: nextMetric, dir: nextDir })
      .then((data) => {
        if (isCancelled) return
        setResult({ key: requestKey, status: 'done', cat: nextCat, metric: nextMetric, dir: nextDir, items: data?.items ?? [], baseDate: data?.baseDate ?? null })
      })
      .catch(() => {
        if (!isCancelled) setResult({ key: requestKey, status: 'error', cat: nextCat, metric: nextMetric, dir: nextDir, items: [], baseDate: null })
      })
    return () => {
      isCancelled = true
    }
  }, [requestKey])

  // 조건이 바뀌어 새로 받는 중(isCurrent가 false)이어도 이전 결과가 있으면 그대로 둠
  const isCurrent = result.key === requestKey
  const hasShownResult = result.status === 'done'
  const items = result.items.slice(0, RANKING_MAX)

  const renderList = () => {
    if (!isCurrent && !hasShownResult) return <Status role="status">순위를 불러오는 중이에요</Status>
    if (result.status === 'error') {
      return (
        <Status>
          순위를 불러오지 못했어요
          <Button $variant="outline" $size="sm" onClick={() => setAttempt((count) => count + 1)}>
            다시 시도
          </Button>
        </Status>
      )
    }
    if (items.length === 0) return <Status>조건에 맞는 상품이 없어요. 금융권을 바꿔 보세요.</Status>
    return (
      <List aria-busy={!isCurrent}>
        {items.map((item) => (
          <RankingItem key={item.rankNo} item={item} metric={result.metric} />
        ))}
      </List>
    )
  }

  return (
    <>
      <PageHeader
        crumbs={['대출 랭킹']}
        title="대출 랭킹"
        description="대출을 고를 때 가장 많이 보는 기준으로 순위를 매겼어요."
      />
      <Tabs aria-label="랭킹 기준">
        {RANKING_METRIC_OPTIONS.map((option) => (
          <Tab key={option.value} aria-selected={option.value === metric} onClick={() => handleMetricChange(option.value)}>
            {option.label}
          </Tab>
        ))}
      </Tabs>
      <Filters>
        <CatBox>
          <SelectField isPill label="금융권" value={cat} onChange={handleCatChange} options={CAT_SELECT_OPTIONS} />
        </CatBox>
        <DirGroup>
          {getRankingDirOptions(metric).map((option) => (
            <DirButton key={option.value} aria-pressed={option.value === dir} onClick={() => handleDirChange(option.value)}>
              {option.label}
            </DirButton>
          ))}
        </DirGroup>
      </Filters>
      <Head>
        <Title>
          <TitleText>{result.cat || ALL_CAT_TITLE}</TitleText>
          <Count>{items.length}</Count>
          <Hint>{getRankingHint(result.metric, result.dir)}</Hint>
        </Title>
        <BaseDateBadge date={result.baseDate} />
      </Head>
      {renderList()}
    </>
  )
}

export default RankingPage
