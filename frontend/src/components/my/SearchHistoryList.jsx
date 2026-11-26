import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as myApi from '../../api/myApi'
import { SEARCH_FILTERS, getKeywordLabel } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { formatDate } from '../../utils/format'
import MySection, { RecordRow } from './MySection'

// MY-06 최근 검색 (검색 기록 10개): 기록 줄 (줄마다 X) / [선택 삭제] [전체 삭제]
// 줄 위 글: 저장된 조건(searchCondition)을 쉼표로 이음. 앞 SHOWN_CONDITIONS개만 보이고 나머지는 '외 N개', 한 줄 넘으면 말줄임
//   (저장된 글 searchLabel은 조건을 읽지 못할 때만 씀) / 줄 아래 글: '상세 검색' 또는 '간편 검색', 검색 날짜
// 줄 → 그 조건으로 다시 검색: 상세 검색 /search?{조건}, 간편 검색 /search/simple?kw= (API-22 searchCondition으로 주소를 만듦)
// 줄 X → API-22 DELETE /{searchId} (404면 목록 다시 불러옴) / [전체 삭제] → API-22 DELETE (전체) / 알림은 MySection (MY-03)
// 맞춤 추천 입력은 기록 안 함 (기록 저장은 상품 찾기 화면이 함)
const SHOWN_CONDITIONS = 3

// 저장된 조건(JSON 글) → 값 (읽지 못하면 null)
// 상세 검색 조건: { q, target, purpose, … } (여러 값은 쉼표로 이은 글) / 간편 검색 조건: 키워드 목록
function parseCondition(item) {
  try {
    return typeof item.searchCondition === 'string' ? JSON.parse(item.searchCondition) : item.searchCondition
  } catch {
    return null
  }
}

// 저장된 조건 → 줄에 보일 조건 글 목록 (상세 검색: “검색어”, 칩 값 / 간편 검색: 키워드 이름). 읽지 못하면 빈 목록
function getConditionTexts(item) {
  const condition = parseCondition(item)
  if (item.searchType === 'SIMPLE') return Array.isArray(condition) ? condition.map(getKeywordLabel) : []
  if (!condition || typeof condition !== 'object') return []
  const texts = condition.q ? [`“${condition.q}”`] : []
  SEARCH_FILTERS.forEach(({ key }) => {
    const value = condition[key]
    const values = Array.isArray(value) ? value : String(value ?? '').split(',')
    texts.push(...values.filter(Boolean))
  })
  return texts
}

// 줄 위 글: 앞 SHOWN_CONDITIONS개를 쉼표로 잇고 나머지는 '외 N개' (조건을 읽지 못하면 저장된 글)
function getConditionSummary(item) {
  const texts = getConditionTexts(item)
  if (texts.length === 0) return item.searchLabel
  const shown = texts.slice(0, SHOWN_CONDITIONS).join(', ')
  return texts.length > SHOWN_CONDITIONS ? `${shown} 외 ${texts.length - SHOWN_CONDITIONS}개` : shown
}

// 저장된 조건 → 다시 검색할 주소 (모양이 틀리면 null)
// 주소 값 검사(정해진 칩, 개수)는 상품 찾기 화면이 주소를 읽을 때 함
function getSearchPath(item) {
  const condition = parseCondition(item)
  const params = new URLSearchParams()
  let base = '/search'
  if (item.searchType === 'SIMPLE') {
    if (!Array.isArray(condition)) return null
    base = '/search/simple'
    if (condition.length > 0) params.set('kw', condition.join(','))
  } else {
    if (!condition || typeof condition !== 'object') return null
    if (condition.q) params.set('q', String(condition.q))
    SEARCH_FILTERS.forEach(({ key }) => {
      const value = Array.isArray(condition[key]) ? condition[key].join(',') : condition[key]
      if (value) params.set(key, String(value))
    })
  }
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

function SearchHistoryList() {
  const navigate = useNavigate()
  const showToast = useUiStore((state) => state.showToast)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [] })

  useEffect(() => {
    let isCancelled = false
    myApi
      .getSearches()
      .then((data) => {
        if (!isCancelled) setResult({ status: 'done', items: data?.items ?? [] })
      })
      .catch(() => {
        if (!isCancelled) setResult({ status: 'error', items: [] })
      })
    return () => {
      isCancelled = true
    }
  }, [attempt])

  // 다시 받을 때 이전 줄을 남김 (받는 동안 MySection이 흐리게 둠)
  const reload = () => {
    setResult((prev) => ({ ...prev, status: 'loading' }))
    setAttempt((count) => count + 1)
  }

  const handleRemove = async (item) => {
    try {
      await myApi.deleteSearch(item.searchId)
      setResult((prev) => ({ ...prev, items: prev.items.filter((one) => one.searchId !== item.searchId) }))
    } catch (error) {
      // 이미 지워진 기록이면 목록을 다시 받음 (API-22)
      if (error.response?.status === 404) reload()
      else throw error
    }
  }

  const handleClearAll = async () => {
    await myApi.deleteSearches()
    setResult({ status: 'done', items: [] })
  }

  const handleSearch = (item) => {
    const path = getSearchPath(item)
    if (path) navigate(path)
    else showToast('검색 조건을 불러오지 못했어요')
  }

  return (
    <MySection
      title="최근 검색"
      description="상품 찾기에서 검색한 조건을 최근 10개까지 보여 줘요."
      status={result.status}
      onRetry={reload}
      items={result.items}
      getKey={(item) => item.searchId}
      getItemLabel={getConditionSummary}
      renderItem={(item) => (
        <RecordRow
          main={getConditionSummary(item)}
          sub={`${item.searchType === 'SIMPLE' ? '간편 검색' : '상세 검색'}, ${formatDate(item.searchedAt)}`}
          onClick={() => handleSearch(item)}
        />
      )}
      onRemove={handleRemove}
      onClearAll={handleClearAll}
      emptyContent="최근 검색이 없어요"
    />
  )
}

export default SearchHistoryList
