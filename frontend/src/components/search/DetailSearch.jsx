import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { getSearches, postSearch } from '../../api/myApi'
import { getFilterChips, getProducts } from '../../api/productApi'
import {
  SEARCH_FILTER_MAX,
  SEARCH_FILTERS,
  SEARCH_PAGE_SIZE,
  SEARCH_QUERY_MAX,
  SEARCH_SORT_OPTIONS,
} from '../../constants/options'
import useAuthStore from '../../store/useAuthStore'
import useCompareStore, { getCompareBlock } from '../../store/useCompareStore'
import useUiStore from '../../store/useUiStore'
import { Button, EmptyBox, Panel } from '../../styles/common'
import ProductList from '../common/ProductList'
import PurposeFilterBanner from '../common/PurposeFilterBanner'
import Icon from '../ui/Icon'
import SearchField from '../ui/SearchField'
import ActiveFilterChips from './ActiveFilterChips'
import FilterRow from './FilterRow'
import RecentSearchChips from './RecentSearchChips'
import ResultBar from './ResultBar'

/*
    SR-02 상세 검색 탭 (/search): 검색칸 + 필터 8줄 + 적용 조건 + 최근 검색 + 결과 바 + 상품 목록
    - 조건은 주소(?q=&target=&purpose=&amount=&repay=&fin=&inst=&region=&credit=&rt=&sort=)에 남김 (useSearchParams, 여러 값은 쉼표).
      바꿀 때는 replace로 주소를 갈아끼움 (뒤로 가기가 조건 한 칸씩이 아니라 이전 화면으로 가게). page는 주소에 안 넣음
    - 주소 값은 누구나 바꿀 수 있어서 정해진 값만 씀: rt, sort는 정해진 코드 아니면 기본값, 필터 값은 API-52 칩 목록에 있는 것만
      → 칩 목록을 받은 뒤에 검색함. 칩 목록을 못 받으면 필터 구역만 실패 문구 + [다시 시도] (E3), 검색은 검색어만으로 함
    - 검색어는 입력 멈춘 뒤 0.3초 뒤 요청 (E8, SearchField), 결과는 20개씩 [더 보기] (E7)
    - 회원: 조건이 바뀌고 0.7초 뒤 최근 검색 기록 (API-22 POST, FILTER). 실패해도 안내 안 함 (서버 CHORONG-42가 올라오기 전에는 '준비 중')
    - 조건도 검색 기록도 없으면 상품 목록 대신 맞춤 추천 바로가기만 (명세서 SR-02)
    - 비교함에 상품이 있으면 첫 상품과 자금 용도, 상환 방식이 안 겹치는 상품은 숨기고 위에 띠 + 숨긴 개수 (CM-10, E15). 숨긴 개수는 지금까지 받은 목록 기준
    - 서버 응답 칸 이름은 CHORONG-65 DTO가 올라올 때 맞춘다 (지금은 아래처럼 가정, docs/history/CHORONG-64/fe_search_history.md)
      API-01: { list, total, page, size, numCount (금리 표시 상품 수), memoCount (금리 기관 문의 상품 수) }
      API-52: { filters: [{ key, chips: [{ value, label, count }], groups (금융권만): [{ value, label, count, members: [세분류 값] }] }] }
      API-22 GET items: { searchId, searchType, searchLabel, searchCondition (JSON 글) }
*/
const RATE_TYPES = ['NUM', 'MEMO']
const SORTS = SEARCH_SORT_OPTIONS.map((option) => option.value)
const RECORD_DELAY_MS = 700 // 조건이 바뀌고 이만큼 지난 뒤 최근 검색 기록 (SR-02)
const LABEL_MAX = 200 // 최근 검색 label 최대 글자 수 (서버 B2)
// 필터 줄 아래 작은 안내: 신용점수는 'NICE 기준' (SR-03), 필요 금액은 한도 기준 (칩이 상품의 최대 한도로 붙어서)
const FILTER_HINT = {
  amount: '한도(최대로 빌릴 수 있는 금액) 기준이에요.',
  credit: '신용점수 구간은 NICE 기준이에요.',
}

const Box = styled(Panel)`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const Top = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const SearchWrap = styled.div`
  flex: 1;
  min-width: 0;
`

const Table = styled.div`
  overflow: hidden;
  border: 1px solid var(--line-2);
  border-radius: var(--r-md);
  background: var(--paper);
`

const TableNotice = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 20px;
  color: var(--cocoa);
  font-size: var(--fs-md);
`

const Foot = styled.div`
  padding-top: 16px;
  border-top: 1px solid var(--line);
`

const Shortcut = styled(Panel)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-top: 28px;
`

const ShortcutTitle = styled.h2`
  font-size: var(--fs-xl);
  font-weight: 800;
`

const ShortcutText = styled.p`
  color: var(--ink-2);
  line-height: 1.6;
`

const Results = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

// 쉼표로 이은 글 → 값 목록 (빈 값, 중복 제거, 한 필터 20개까지)
function parseList(text) {
  const values = String(text ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return [...new Set(values)].slice(0, SEARCH_FILTER_MAX)
}

// 주소 값 읽기: 정해진 값이 아니면 기본값 (필터 값은 칩 목록에 있는지 검사하기 전의 값)
function readParams(searchParams) {
  const lists = {}
  SEARCH_FILTERS.forEach(({ key }) => {
    lists[key] = parseList(searchParams.get(key))
  })
  const rt = RATE_TYPES.includes(searchParams.get('rt')) ? searchParams.get('rt') : 'NUM'
  const sortValue = searchParams.get('sort')
  let sort = SORTS.includes(sortValue) ? sortValue : 'base'
  // 금리 기관 문의 탭에서는 금리 낮은 순을 끔
  if (rt === 'MEMO' && sort === 'rate') sort = 'base'
  return { q: (searchParams.get('q') ?? '').trim().slice(0, SEARCH_QUERY_MAX), lists, rt, sort }
}

// 조건 → 주소 값 (기본값은 안 적음)
function buildSearchParams({ q, lists, rt, sort }) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  SEARCH_FILTERS.forEach(({ key }) => {
    if (lists[key].length > 0) params.set(key, lists[key].join(','))
  })
  if (rt !== 'NUM') params.set('rt', rt)
  if (sort !== 'base') params.set('sort', sort)
  return params
}

function DetailSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const showToast = useUiStore((state) => state.showToast)
  const authStatus = useAuthStore((state) => state.status)
  const tray = useCompareStore((state) => state.tray)
  const raw = readParams(searchParams)

  // 검색칸 글자: 입력 중인 글을 지우지 않으려고 따로 둠. 주소의 검색어가 바뀌면 (최근 검색, 초기화) 맞춤
  const [qText, setQText] = useState(raw.q)
  const [shownQ, setShownQ] = useState(raw.q)
  if (raw.q !== shownQ) {
    setShownQ(raw.q)
    if (raw.q !== qText.trim()) setQText(raw.q)
  }
  const [isFilterOpen, setIsFilterOpen] = useState(true)

  // 필터 칩 목록 (API-52): 화면을 열 때 한 번
  const [chipsAttempt, setChipsAttempt] = useState(0)
  const [chipsState, setChipsState] = useState({ status: 'loading', filters: [] })
  useEffect(() => {
    let isCancelled = false
    getFilterChips()
      .then((data) => {
        if (!isCancelled) setChipsState({ status: 'done', filters: data?.filters ?? [] })
      })
      .catch(() => {
        if (!isCancelled) setChipsState({ status: 'error', filters: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [chipsAttempt])

  const retryChips = () => {
    setChipsState({ status: 'loading', filters: [] })
    setChipsAttempt((count) => count + 1)
  }

  const isChipsDone = chipsState.status === 'done'
  const getFilter = (key) => chipsState.filters.find((filter) => filter.key === key)
  // 칩 목록에 없는 값은 빼고 씀 (칩 목록을 받기 전, 못 받았을 때는 필터 값을 안 씀)
  const applied = {}
  SEARCH_FILTERS.forEach(({ key }) => {
    const values = new Set((getFilter(key)?.chips ?? []).map((chip) => chip.value))
    applied[key] = isChipsDone ? raw.lists[key].filter((value) => values.has(value)) : []
  })
  const baseLists = isChipsDone ? applied : raw.lists
  const hasConditions = Boolean(raw.q) || SEARCH_FILTERS.some(({ key }) => baseLists[key].length > 0)

  // 주소 바꾸기 (바꿀 것만 넘김)
  const writeParams = (changes) => {
    setSearchParams(buildSearchParams({ ...raw, lists: baseLists, ...changes }), { replace: true })
  }
  const handleSearch = (text) => writeParams({ q: text })
  const handleFilterChange = (key, values) => writeParams({ lists: { ...baseLists, [key]: values } })
  const handleRemove = ({ key, values }) => {
    if (key === 'q') {
      setQText('')
      writeParams({ q: '' })
      return
    }
    writeParams({ lists: { ...baseLists, [key]: baseLists[key].filter((value) => !values.includes(value)) } })
  }
  const handleReset = () => {
    const empty = {}
    SEARCH_FILTERS.forEach(({ key }) => {
      empty[key] = []
    })
    setQText('')
    writeParams({ q: '', lists: empty })
  }
  const handleChangeRt = (rt) => writeParams({ rt, sort: rt === 'MEMO' && raw.sort === 'rate' ? 'base' : raw.sort })
  const handleChangeSort = (sort) => writeParams({ sort })

  // 최근 검색 (회원): 목록 받기 (API-22 GET). 못 받아도 안내 없이 빈 목록
  const isMember = authStatus === 'member'
  const [historyAttempt, setHistoryAttempt] = useState(0)
  const [searchHistory, setSearchHistory] = useState({ isLoaded: false, items: [] })
  useEffect(() => {
    if (!isMember) return
    let isCancelled = false
    getSearches()
      .then((data) => {
        if (!isCancelled) setSearchHistory({ isLoaded: true, items: data?.items ?? [] })
      })
      .catch(() => {
        if (!isCancelled) setSearchHistory({ isLoaded: true, items: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [isMember, historyAttempt])
  const historyItems = isMember ? searchHistory.items : []
  const isHistoryReady = authStatus === 'guest' || (isMember && searchHistory.isLoaded)

  // 최근 검색 기록 (회원): 조건이 바뀌고 0.7초 뒤 한 번만. label은 시안 모양 '“검색어” · 칩 · 칩', condition은 주소와 같은 이름의 값 (JSON 글)
  const labelParts = [raw.q && `“${raw.q}”`, ...SEARCH_FILTERS.flatMap(({ key }) => applied[key])].filter(Boolean)
  const historyLabel = labelParts.join(' · ').slice(0, LABEL_MAX)
  const condition = {}
  if (raw.q) condition.q = raw.q
  SEARCH_FILTERS.forEach(({ key }) => {
    if (applied[key].length > 0) condition[key] = applied[key].join(',')
  })
  const conditionText = JSON.stringify(condition)
  useEffect(() => {
    if (!isMember || !historyLabel) return
    const timer = setTimeout(() => {
      postSearch({ type: 'FILTER', label: historyLabel, condition: conditionText })
        .then(() => setHistoryAttempt((count) => count + 1))
        .catch(() => {})
    }, RECORD_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isMember, historyLabel, conditionText])

  // 최근 검색 칩 → 그 조건으로 주소를 바꿈 (rt, sort는 기본값으로)
  const handleRecent = (item) => {
    let saved = null
    try {
      saved = typeof item.searchCondition === 'string' ? JSON.parse(item.searchCondition) : item.searchCondition
    } catch {
      saved = null
    }
    if (!saved || typeof saved !== 'object') {
      showToast('검색 조건을 불러오지 못했어요')
      return
    }
    const lists = {}
    SEARCH_FILTERS.forEach(({ key }) => {
      lists[key] = parseList(Array.isArray(saved[key]) ? saved[key].join(',') : saved[key])
    })
    setSearchParams(
      buildSearchParams({ q: String(saved.q ?? '').trim().slice(0, SEARCH_QUERY_MAX), lists, rt: 'NUM', sort: 'base' }),
      { replace: true },
    )
  }

  // 상품 목록 (API-01): 칩 목록 확인이 끝나면, 조건이 있거나 최근 검색이 있을 때만
  const isShortcut = !hasConditions && isHistoryReady && historyItems.length === 0
  const canSearch = chipsState.status !== 'loading' && (hasConditions || (isHistoryReady && !isShortcut))
  const params = { rt: raw.rt, sort: raw.sort, size: SEARCH_PAGE_SIZE }
  if (raw.q) params.q = raw.q
  SEARCH_FILTERS.forEach(({ key }) => {
    if (applied[key].length > 0) params[key] = applied[key].join(',')
  })
  const [attempt, setAttempt] = useState(0)
  const requestKey = canSearch ? JSON.stringify({ params, attempt }) : ''
  const [result, setResult] = useState({ key: '', status: 'loading', items: [], numCount: 0, memoCount: 0, page: 1, isEnd: false })
  useEffect(() => {
    if (!requestKey) return
    const { params: query } = JSON.parse(requestKey)
    let isCancelled = false
    getProducts({ ...query, page: 1 })
      .then((data) => {
        if (isCancelled) return
        const items = data?.list ?? []
        setResult({
          key: requestKey,
          status: 'done',
          items,
          numCount: data?.numCount ?? 0,
          memoCount: data?.memoCount ?? 0,
          page: 1,
          isEnd: items.length < SEARCH_PAGE_SIZE,
        })
      })
      .catch(() => {
        if (!isCancelled) {
          setResult({ key: requestKey, status: 'error', items: [], numCount: 0, memoCount: 0, page: 1, isEnd: true })
        }
      })
    return () => {
      isCancelled = true
    }
  }, [requestKey])
  // 조건이 바뀌어 새로 받는 중이면 지난 결과를 안 보여 줌
  const view = result.key === requestKey ? result : { ...result, status: 'loading', items: [] }

  // [더 보기]: 다음 쪽을 받아 뒤에 붙임 (E7, 연타 방지 E5)
  const [isMoreLoading, setIsMoreLoading] = useState(false)
  const handleMore = async () => {
    if (isMoreLoading) return
    setIsMoreLoading(true)
    const key = requestKey
    try {
      const data = await getProducts({ ...params, page: view.page + 1 })
      const received = data?.list ?? []
      setResult((prev) => {
        if (prev.key !== key) return prev
        const known = new Set(prev.items.map((item) => item.productId))
        return {
          ...prev,
          items: [...prev.items, ...received.filter((item) => !known.has(item.productId))],
          page: prev.page + 1,
          isEnd: received.length < SEARCH_PAGE_SIZE,
        }
      })
    } catch {
      showToast('상품을 더 불러오지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsMoreLoading(false)
    }
  }

  const tabCount = raw.rt === 'NUM' ? view.numCount : view.memoCount
  const hasMore = !view.isEnd && view.items.length < tabCount

  // 비교함 필터: 비교함 첫 상품과 안 겹치는 상품은 숨김 (이미 비교함에 담긴 상품은 보임)
  const isHiddenByTray = (product) =>
    tray.length > 0 &&
    !tray.some((item) => item.productId === product.productId) &&
    getCompareBlock(tray[0], product) !== null
  const shownItems = view.items.filter((product) => !isHiddenByTray(product))
  const hiddenCount = view.items.length - shownItems.length

  const renderResults = () => {
    if (view.status === 'loading') return <EmptyBox role="status">상품을 불러오는 중이에요</EmptyBox>
    if (view.status === 'error') {
      return (
        <EmptyBox>
          상품을 불러오지 못했어요
          <Button $variant="outline" $size="sm" onClick={() => setAttempt((count) => count + 1)}>
            다시 시도
          </Button>
        </EmptyBox>
      )
    }
    if (view.items.length === 0) {
      return (
        <EmptyBox>
          조건에 맞는 상품이 없어요. 위의 조건 칩에서 X를 눌러 하나씩 빼 보세요.
          {hasConditions && (
            <Button $variant="outline" $size="sm" onClick={handleReset}>
              필터 초기화
            </Button>
          )}
        </EmptyBox>
      )
    }
    if (shownItems.length === 0) {
      return (
        <EmptyBox>
          비교함 상품과 자금 용도, 상환 방식이 겹치는 상품이 아직 없어요
          {hasMore && (
            <Button $variant="outline" $size="sm" onClick={handleMore} disabled={isMoreLoading}>
              {isMoreLoading ? '불러오는 중' : '더 보기'}
            </Button>
          )}
        </EmptyBox>
      )
    }
    return (
      <ProductList
        items={shownItems}
        hasMore={hasMore}
        onMore={handleMore}
        isMoreLoading={isMoreLoading}
        getRowProps={() => ({ keyword: raw.q })}
      />
    )
  }

  return (
    <section aria-label="상세 검색">
      <Box>
        <Top>
          <SearchWrap>
            <SearchField
              value={qText}
              onChange={setQText}
              onSearch={handleSearch}
              placeholder="상품명, 금융사 검색"
              label="상품 검색"
            />
          </SearchWrap>
          <Button
            $variant="outline"
            $size="sm"
            aria-expanded={isFilterOpen}
            onClick={() => setIsFilterOpen((isOpen) => !isOpen)}
          >
            {isFilterOpen ? '필터 접기' : '필터 열기'}
          </Button>
        </Top>
        {isFilterOpen && (
          <Table>
            {chipsState.status === 'loading' && <TableNotice role="status">필터를 불러오는 중이에요</TableNotice>}
            {chipsState.status === 'error' && (
              <TableNotice>
                필터를 불러오지 못했어요
                <Button $variant="outline" $size="sm" onClick={retryChips}>
                  다시 시도
                </Button>
              </TableNotice>
            )}
            {isChipsDone &&
              SEARCH_FILTERS.filter(({ key }) => (getFilter(key)?.chips ?? []).length > 0).map(({ key, label }) => (
                <FilterRow
                  key={key}
                  label={label}
                  chips={getFilter(key)?.chips ?? []}
                  groups={getFilter(key)?.groups ?? []}
                  selected={applied[key]}
                  hint={FILTER_HINT[key] ?? ''}
                  onChange={(values) => handleFilterChange(key, values)}
                />
              ))}
          </Table>
        )}
        <Foot>
          <ActiveFilterChips
            q={raw.q}
            selected={applied}
            groups={getFilter('fin')?.groups ?? []}
            onRemove={handleRemove}
            onReset={handleReset}
          />
        </Foot>
      </Box>

      <RecentSearchChips items={historyItems} onSelect={handleRecent} />

      {isShortcut ? (
        <Shortcut>
          <ShortcutTitle>어떤 조건으로 찾을지 아직 정하지 못했다면</ShortcutTitle>
          <ShortcutText>위에서 조건을 고르면 바로 결과가 나와요. 내 상황을 모르겠다면 맞춤 추천부터 받아 보세요.</ShortcutText>
          <Button as={Link} to="/recommend" $variant="outline" $size="sm">
            맞춤 추천 받기
            <Icon name="arrow" size={13} />
          </Button>
        </Shortcut>
      ) : (
        <>
          <ResultBar
            numCount={view.status === 'done' ? view.numCount : null}
            memoCount={view.status === 'done' ? view.memoCount : null}
            rt={raw.rt}
            sort={raw.sort}
            onChangeRt={handleChangeRt}
            onChangeSort={handleChangeSort}
          />
          <Results>
            {view.status === 'done' && <PurposeFilterBanner hiddenCount={hiddenCount} />}
            {renderResults()}
          </Results>
        </>
      )}
    </section>
  )
}

export default DetailSearch
