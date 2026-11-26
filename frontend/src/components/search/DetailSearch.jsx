import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
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
import useCompareStore, { getMethodLabels, getPinnedProduct, useCompareItems } from '../../store/useCompareStore'
import useUiStore from '../../store/useUiStore'
import { Button, EmptyBox, IconButton, Panel } from '../../styles/common'
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
    - 조건은 주소(?q=&target=&purpose=&amount=&repay=&fin=&inst=&region=&credit=&rt=&sort=&page=)에 남김 (useSearchParams, 여러 값은 쉼표).
      바꿀 때는 replace로 주소를 갈아끼움 (뒤로 가기가 조건 한 칸씩이 아니라 이전 화면으로 가게). page는 1쪽이면 안 적음
    - 주소 값은 누구나 바꿀 수 있어서 정해진 값만 씀: rt, sort는 정해진 코드 아니면 기본값, 필터 값은 API-52 칩 목록에 있는 것만
      → 칩 목록을 받은 뒤에 검색함. 칩 목록을 못 받으면 필터 구역만 실패 문구 + [다시 시도] (E3), 검색은 검색어만으로 함
    - 검색어는 입력 멈춘 뒤 0.3초 뒤 요청 (E8, SearchField), 결과는 20개씩 번호 쪽 나눔 (이전, 다음 + '1 / 70' + 쪽 번호 입력 이동, 요청서 D7). 조건이 바뀌면 1쪽으로
    - 회원: 조건이 바뀌고 0.7초 뒤 최근 검색 기록 (API-22 POST, FILTER). 실패해도 안내 안 함 (서버 CHORONG-42가 올라오기 전에는 '준비 중')
    - 조건이 없으면 (검색어 없음, 필터 전부 [전체]) 전체 상품 목록 (CHORONG-86)
    - 비교할 상품을 고르는 중이면 남겨 둔 상품 번호를 cmp로 같이 보내 서버가 그 상품과 자금 용도, 상환 방식이 안 겹치는 상품을 거름 (CM-10, E15, 요청서 A)
      → 목록, 건수, 쪽 수는 거른 뒤 값. 위 띠에는 응답의 hiddenCount (숨긴 개수, 지금 금리 탭 기준)를 넘김. 프론트는 목록을 따로 거르지 않음. 기준 상품이 바뀌면 다시 검색
    - 서버 응답 칸 이름은 CHORONG-65 DTO가 올라올 때 맞춘다 (지금은 아래처럼 가정, docs/history/CHORONG-64/fe_search_history.md)
      API-01: { list, total, page, size, numCount (금리 표시 상품 수), memoCount (금리 기관 문의 상품 수) }
      API-52: { filters: [{ key, chips: [{ value, label, count }], groups (금융권만): [{ value, label, count, members: [세분류 값] }] }] }
      API-22 GET items: { searchId, searchType, searchLabel, searchCondition (JSON 글) }
*/
const RATE_TYPES = ['NUM', 'MEMO']
const SORTS = SEARCH_SORT_OPTIONS.map((option) => option.value)
const RECORD_DELAY_MS = 700 // 조건이 바뀌고 이만큼 지난 뒤 최근 검색 기록 (SR-02)
const LABEL_MAX = 200 // 최근 검색 label 최대 글자 수 (서버 B2)
const PAGE_MAX = 100000 // 서버가 받는 쪽 번호 최대 (ProductSearchRequestDTO)
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

const Results = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

// 쪽을 넘기면 여기로 스크롤 (위쪽 고정 머리 높이만큼 띄움)
const ResultsTop = styled.div`
  scroll-margin-top: 84px;
`

// 쪽 넘김: 맞춤 추천 결과(RecommendResult)와 같은 모양 (이전, 다음 화살표 + '1 / 70')
const Pager = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 20px;
`

const PrevButton = styled(IconButton)`
  & [data-icon] {
    transform: rotate(180deg);
  }
`

const PageNumber = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 800;
`

// 쪽 번호를 입력해 바로 이동
const GoForm = styled.form`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
`

const GoInput = styled.input`
  width: 64px;
  height: 36px;
  padding: 0 8px;
  border: 1px solid var(--line-2);
  border-radius: var(--r-sm);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--f-num);
  font-size: var(--fs-base);
  font-weight: 700;
  text-align: center;
  outline: none;
  &:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px var(--brand-soft);
  }
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
  // 쪽: 1 이상 정수만 (이상한 값은 1쪽)
  const pageNumber = Number(searchParams.get('page'))
  const page = Number.isInteger(pageNumber) && pageNumber >= 1 ? Math.min(pageNumber, PAGE_MAX) : 1
  return { q: (searchParams.get('q') ?? '').trim().slice(0, SEARCH_QUERY_MAX), lists, rt, sort, page }
}

// 조건 → 주소 값 (기본값은 안 적음)
function buildSearchParams({ q, lists, rt, sort, page }) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  SEARCH_FILTERS.forEach(({ key }) => {
    if (lists[key].length > 0) params.set(key, lists[key].join(','))
  })
  if (rt !== 'NUM') params.set('rt', rt)
  if (sort !== 'base') params.set('sort', sort)
  if (page > 1) params.set('page', String(page))
  return params
}

function DetailSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const showToast = useUiStore((state) => state.showToast)
  const authStatus = useAuthStore((state) => state.status)
  const baseItems = useCompareItems() // 거르는 기준 상품 (비교 화면의 한 칸을 고르러 나온 중 남은 상품)
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

  // 비교 화면의 한 칸을 고르는 중에는 자금 용도, 상환 방법 줄을 남겨 둔 상품의 칩으로 고정 (못 누름)
  // 사용자가 그 줄에 골라 둔 값은 지우지 않고 주소에 둔 채 잠시 안 씀 → 고르기가 풀리면 다시 켜짐
  // 고정한 칩은 주소에 안 적음. 목록 거르기는 서버가 cmp로 함 (상환 방식 정보가 없는 상품도 남게)
  const isPicking = useCompareStore((state) => state.pickSlot !== null)
  const pickBase = useCompareStore((state) => state.pickBase)
  const pickChips = pickBase ? { purpose: pickBase.purposes, repay: getMethodLabels(pickBase) } : {}
  const locked = {} // 고정한 줄: 줄 이름 -> 켜 보일 값
  const used = {} // 사용자가 고른 값 중 지금 쓰는 것 (고정한 줄은 뺌)
  SEARCH_FILTERS.forEach(({ key }) => {
    const values = new Set((getFilter(key)?.chips ?? []).map((chip) => chip.value))
    const fixed = (pickChips[key] ?? []).filter((value) => values.has(value))
    if (fixed.length > 0) locked[key] = fixed
    used[key] = fixed.length > 0 ? [] : applied[key]
  })

  // 주소 바꾸기 (바꿀 것만 넘김). 조건을 바꾸면 1쪽으로, 쪽만 바꿀 때는 page를 같이 넘김
  const writeParams = (changes) => {
    setSearchParams(buildSearchParams({ ...raw, lists: baseLists, page: 1, ...changes }), { replace: true })
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
      buildSearchParams({ q: String(saved.q ?? '').trim().slice(0, SEARCH_QUERY_MAX), lists, rt: 'NUM', sort: 'base', page: 1 }),
      { replace: true },
    )
  }

  // 상품 목록 (API-01): 칩 목록 확인이 끝나면 검색 (조건이 없으면 전체 상품)
  const canSearch = chipsState.status !== 'loading'
  const params = { rt: raw.rt, sort: raw.sort, size: SEARCH_PAGE_SIZE, page: raw.page }
  if (baseItems.length > 0) params.cmp = baseItems.map((item) => item.productId).join(',') // 거르는 기준 상품 번호
  if (raw.q) params.q = raw.q
  // 고정한 줄의 값은 안 보냄: 남겨 둔 상품 기준 거르기는 cmp가 함
  SEARCH_FILTERS.forEach(({ key }) => {
    if (used[key].length > 0) params[key] = used[key].join(',')
  })
  const [attempt, setAttempt] = useState(0)
  const requestKey = canSearch ? JSON.stringify({ params, attempt }) : ''
  const [result, setResult] = useState({ key: '', status: 'loading', items: [], numCount: 0, memoCount: 0, hiddenCount: 0 })
  useEffect(() => {
    if (!requestKey) return
    const { params: query } = JSON.parse(requestKey)
    let isCancelled = false
    getProducts(query)
      .then((data) => {
        if (isCancelled) return
        setResult({
          key: requestKey,
          status: 'done',
          items: data?.list ?? [],
          numCount: data?.numCount ?? 0,
          memoCount: data?.memoCount ?? 0,
          hiddenCount: data?.hiddenCount ?? 0,
        })
      })
      .catch(() => {
        if (!isCancelled) {
          setResult({ key: requestKey, status: 'error', items: [], numCount: 0, memoCount: 0, hiddenCount: 0 })
        }
      })
    return () => {
      isCancelled = true
    }
  }, [requestKey])
  // 조건이 바뀌어 새로 받는 중이면 지난 결과를 안 보여 줌
  const view = result.key === requestKey ? result : { ...result, status: 'loading', items: [] }

  // 쪽 넘김 (요청서 D7): 지금 금리 탭의 건수로 전체 쪽 수를 셈. 쪽을 넘기면 결과 바 위로 스크롤
  const tabCount = raw.rt === 'NUM' ? view.numCount : view.memoCount
  const pageCount = Math.max(1, Math.ceil(tabCount / SEARCH_PAGE_SIZE))
  // 비교 화면의 한 칸을 고르는 중이면 거르기로 결과가 줄어 지금 쪽이 없어질 수 있음: 없는 쪽이 되면 알아서 1쪽으로 (평소에는 '없는 쪽이에요' 안내와 [1쪽으로] 버튼)
  const isEmptyPage = view.status === 'done' && view.items.length === 0 && tabCount > 0 && raw.page > 1
  useEffect(() => {
    if (!isPicking || !isEmptyPage) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }, [isPicking, isEmptyPage, setSearchParams])
  const resultsRef = useRef(null)
  const goPage = (page) => {
    writeParams({ page })
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  // 쪽 번호 입력 이동: 1부터 전체 쪽 수 사이의 정수만 (E2), 아니면 알림
  const [pageText, setPageText] = useState('')
  const handleGo = (event) => {
    event.preventDefault()
    const number = Number(pageText)
    if (pageText === '' || !Number.isInteger(number) || number < 1 || number > pageCount) {
      showToast(`1~${pageCount} 사이의 쪽 번호를 입력해 주세요`)
      return
    }
    setPageText('')
    if (number !== raw.page) goPage(number)
  }

  // 고르는 중에는 남겨 둔 상품을 1쪽 맨 위에 고정 (칩, 검색어, 쪽에 상관없이). 다른 쪽에서는 중복으로 안 보이게 뺌
  const pinned = useCompareStore(getPinnedProduct)
  const pinnedRow = pinned && raw.page === 1 ? (view.items.find((item) => item.productId === pinned.productId) ?? pinned) : null
  const otherItems = pinned ? view.items.filter((item) => item.productId !== pinned.productId) : view.items
  const listItems = pinnedRow ? [pinnedRow, ...otherItems] : otherItems

  // 보여 줄 상품이 없는 이유 안내: 거르는 기준 때문에 모두 빠졌으면(서버가 알려 준 숨긴 개수가 있음) 그 안내, 아니면 조건 안내
  const renderNoMatch = () => {
    if (view.hiddenCount > 0) {
      return <EmptyBox>비교할 상품과 자금 용도, 상환 방식이 겹치는 상품이 없어요. 다른 조건으로 찾아 보세요.</EmptyBox>
    }
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
    // 고정한 상품이 있으면 조건에 맞는 다른 상품이 없어도 그 상품은 보여 주고, 아래에 이유를 안내
    // 건수는 있는데 이 쪽이 비었으면 없는 쪽 (주소의 page를 직접 고쳤을 때 등)
    if (listItems.length === 0 && tabCount > 0) {
      return (
        <EmptyBox>
          없는 쪽이에요 (전체 {pageCount}쪽)
          <Button $variant="outline" $size="sm" onClick={() => goPage(1)}>
            1쪽으로
          </Button>
        </EmptyBox>
      )
    }
    if (listItems.length === 0) return renderNoMatch()
    const list = <ProductList items={listItems} getRowProps={() => ({ keyword: raw.q })} />
    if (pinnedRow && otherItems.length === 0) {
      return (
        <>
          {list}
          {renderNoMatch()}
        </>
      )
    }
    return list
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
                  selected={locked[key] ?? applied[key]}
                  isLocked={Boolean(locked[key])}
                  hint={FILTER_HINT[key] ?? ''}
                  onChange={(values) => handleFilterChange(key, values)}
                />
              ))}
          </Table>
        )}
        <Foot>
          <ActiveFilterChips
            q={raw.q}
            selected={used}
            locked={locked}
            groups={getFilter('fin')?.groups ?? []}
            onRemove={handleRemove}
            onReset={handleReset}
          />
        </Foot>
      </Box>

      <RecentSearchChips items={historyItems} onSelect={handleRecent} />

      <ResultsTop ref={resultsRef}>
        <ResultBar
          numCount={view.status === 'done' ? view.numCount : null}
          memoCount={view.status === 'done' ? view.memoCount : null}
          rt={raw.rt}
          sort={raw.sort}
          onChangeRt={handleChangeRt}
          onChangeSort={handleChangeSort}
        />
        <Results>
          {view.status === 'done' && <PurposeFilterBanner hiddenCount={view.hiddenCount} />}
          {renderResults()}
          {view.status === 'done' && view.items.length > 0 && pageCount > 1 && (
            <Pager>
              <PrevButton aria-label="이전 쪽" disabled={raw.page <= 1} onClick={() => goPage(raw.page - 1)}>
                <Icon name="chevron_right" />
              </PrevButton>
              <PageNumber aria-label={`${pageCount}쪽 중 ${raw.page}쪽`}>
                {raw.page} / {pageCount}
              </PageNumber>
              <IconButton aria-label="다음 쪽" disabled={raw.page >= pageCount} onClick={() => goPage(raw.page + 1)}>
                <Icon name="chevron_right" />
              </IconButton>
              <GoForm onSubmit={handleGo}>
                <GoInput
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label="이동할 쪽 번호"
                  placeholder="쪽"
                  value={pageText}
                  onChange={(event) => setPageText(event.target.value.replace(/\D/g, '').slice(0, String(pageCount).length))}
                />
                <Button type="submit" $variant="outline" $size="sm">
                  이동
                </Button>
              </GoForm>
            </Pager>
          )}
        </Results>
      </ResultsTop>
    </section>
  )
}

export default DetailSearch
