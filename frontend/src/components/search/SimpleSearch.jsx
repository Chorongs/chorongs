import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { postSearch } from '../../api/myApi'
import { postKeywordSearch } from '../../api/recommendApi'
import { getKeywordLabel, KEYWORD_ALL, KEYWORD_GROUPS, KEYWORD_MAX } from '../../constants/options'
import useAuthStore from '../../store/useAuthStore'
import useCompareStore, { getCompareBlock } from '../../store/useCompareStore'
import { Button, EmptyBox, Panel } from '../../styles/common'
import ProductList from '../common/ProductList'
import PurposeFilterBanner from '../common/PurposeFilterBanner'
import ChipGroup from '../ui/ChipGroup'
import PresetCards from './PresetCards'
import SimpleSummary from './SimpleSummary'

/*
    SR-07 간편 검색 탭 (/search/simple): 자주 쓰는 조합 + 키워드 3그룹 (나는, 원하는 건, 지금 상황) + 요약 + 상품 목록 (최대 5개)
    - 키워드는 주소(?kw=사회초년생,낮은 금리)에 남김 (useSearchParams, 쉼표). 정해진 14개만, 중복은 빼고, 5개까지만 씀
    - 키워드를 고르거나 조합을 누르면 바로 다시 추천 (API-07 POST). 6번째 키워드는 알림 '최대 5개까지 고를 수 있어요' (ChipGroup)
    - 키워드가 0개면 안내 글만 (요청 안 보냄). 결과 0건이면 빈 상태 (E11), 실패면 문구 + [다시 시도] (E3)
    - 회원: 키워드가 바뀌고 0.7초 뒤 최근 검색 기록 (API-22 POST, SIMPLE) 한 번만. 실패해도 안내 안 함
      label '간편 검색 · A + B', condition 키워드 목록 (JSON 글)
    - 비교함에 상품이 있으면 첫 상품과 자금 용도, 상환 방식이 안 겹치는 상품은 숨기고 위에 띠 + 숨긴 개수 (CM-10, E15)
    - 상품 한 줄에는 충족한 키워드 이유 문구 + 'N/M 일치' (ProductRow hits, total). 일치 개수는 이유 문구 개수로 셈
    - 서버 응답 칸 이름은 CHORONG-65 DTO가 올라올 때 맞춘다 (지금은 아래처럼 가정, docs/history/CHORONG-64/fe_search_history.md)
      API-07: { items: [{ product (ProductSummaryDTO), reasons (충족한 키워드별 이유 문구 목록) }], missedKeywords (1위 상품이 못 맞춘 키워드) }
*/
const RECORD_DELAY_MS = 700 // 키워드가 바뀌고 이만큼 지난 뒤 최근 검색 기록

const Box = styled(Panel)`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const GroupLabel = styled.span`
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
`

const Hint = styled.p`
  color: var(--muted);
  font-size: var(--fs-sm);
`

const Results = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const ListWrap = styled.div`
  margin-top: 8px;
`

// 쉼표로 이은 글 → 키워드 목록 (정해진 14개만, 중복 빼기, 5개까지)
function parseKeywords(text) {
  const values = String(text ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => KEYWORD_ALL.includes(value))
  return [...new Set(values)].slice(0, KEYWORD_MAX)
}

function SimpleSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const authStatus = useAuthStore((state) => state.status)
  const tray = useCompareStore((state) => state.tray)
  const keywords = parseKeywords(searchParams.get('kw'))

  const handleChange = (next) => {
    const params = new URLSearchParams()
    if (next.length > 0) params.set('kw', next.join(','))
    setSearchParams(params, { replace: true })
  }

  // 추천 요청 (API-07)
  const [attempt, setAttempt] = useState(0)
  const requestKey = keywords.length > 0 ? JSON.stringify({ keywords, attempt }) : ''
  const [result, setResult] = useState({ key: '', status: 'loading', items: [], missedKeywords: [] })
  useEffect(() => {
    if (!requestKey) return
    const { keywords: list } = JSON.parse(requestKey)
    let isCancelled = false
    postKeywordSearch(list)
      .then((data) => {
        if (!isCancelled) {
          setResult({ key: requestKey, status: 'done', items: data?.items ?? [], missedKeywords: data?.missedKeywords ?? [] })
        }
      })
      .catch(() => {
        if (!isCancelled) setResult({ key: requestKey, status: 'error', items: [], missedKeywords: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [requestKey])
  // 키워드가 바뀌어 새로 받는 중이면 지난 결과를 안 보여 줌
  const view = result.key === requestKey ? result : { ...result, status: 'loading', items: [] }

  // 최근 검색 기록 (회원): 키워드가 바뀌고 0.7초 뒤 한 번만
  const isMember = authStatus === 'member'
  const historyLabel = keywords.length > 0 ? `간편 검색 · ${keywords.map(getKeywordLabel).join(' + ')}` : ''
  const conditionText = JSON.stringify(keywords)
  useEffect(() => {
    if (!isMember || !historyLabel) return
    const timer = setTimeout(() => {
      postSearch({ type: 'SIMPLE', label: historyLabel, condition: conditionText }).catch(() => {})
    }, RECORD_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isMember, historyLabel, conditionText])

  // 비교함 필터: 비교함 첫 상품과 안 겹치는 상품은 숨김 (이미 비교함에 담긴 상품은 보임)
  const isHiddenByTray = (product) =>
    tray.length > 0 &&
    !tray.some((item) => item.productId === product.productId) &&
    getCompareBlock(tray[0], product) !== null
  const shownItems = view.items.filter((item) => !isHiddenByTray(item.product))
  const hiddenCount = view.items.length - shownItems.length
  // 요약은 서버가 준 1위 기준 (1위가 비교함 때문에 숨겨져도 요약은 그대로)
  const best = view.items[0]

  const renderResults = () => {
    if (keywords.length === 0) {
      return <EmptyBox>키워드를 하나 이상 골라 주세요. 위의 ‘자주 쓰는 조합’으로 시작해도 좋아요.</EmptyBox>
    }
    if (view.status === 'loading') return <EmptyBox role="status">추천 상품을 찾는 중이에요</EmptyBox>
    if (view.status === 'error') {
      return (
        <EmptyBox>
          추천 상품을 불러오지 못했어요
          <Button $variant="outline" $size="sm" onClick={() => setAttempt((count) => count + 1)}>
            다시 시도
          </Button>
        </EmptyBox>
      )
    }
    if (view.items.length === 0) return <EmptyBox>이 조합에 맞는 상품이 없어요. 키워드를 줄여 보세요.</EmptyBox>
    return (
      <>
        <SimpleSummary
          keywords={keywords}
          bestName={best.product.productName}
          matchedCount={best.reasons?.length ?? 0}
          missedKeywords={view.missedKeywords}
        />
        <PurposeFilterBanner hiddenCount={hiddenCount} />
        <ListWrap>
          <ProductList
            items={shownItems.map((item) => item.product)}
            emptyText="비교함 상품과 자금 용도, 상환 방식이 겹치는 상품이 없어요"
            getRowProps={(_, index) => ({ hits: shownItems[index].reasons ?? [], total: keywords.length })}
          />
        </ListWrap>
      </>
    )
  }

  return (
    <section aria-label="간편 검색">
      <Box>
        <Group>
          <GroupLabel>자주 쓰는 조합</GroupLabel>
          <PresetCards keywords={keywords} onSelect={handleChange} />
        </Group>
        {KEYWORD_GROUPS.map((group) => (
          <Group key={group.key}>
            <GroupLabel>{group.label}</GroupLabel>
            <ChipGroup
              options={group.keywords.map((keyword) => ({ value: keyword, label: getKeywordLabel(keyword) }))}
              value={keywords}
              onChange={handleChange}
              isMultiple
              max={KEYWORD_MAX}
              label={group.label}
            />
          </Group>
        ))}
        <Hint>키워드는 5개까지 고를 수 있어요. 고른 키워드를 몇 개 충족하는지 많은 순서로 보여드려요.</Hint>
      </Box>
      <Results>{renderResults()}</Results>
    </section>
  )
}

export default SimpleSearch
