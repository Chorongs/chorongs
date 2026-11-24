import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as myApi from '../../api/myApi'
import { SEARCH_FILTERS } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Chip } from '../../styles/common'
import MySection from './MySection'

// MY-06 최근 검색 (검색 기록 10개): 칩 (칩마다 X) / 지우기
// 칩 → 그 조건으로 다시 검색: 상세 검색 /search?{조건}, 간편 검색 /search/simple?kw= (API-22 searchCondition으로 주소를 만듦)
// 칩 X → API-22 DELETE /{searchId} (404면 목록 다시 불러옴) / 지우기 → API-22 DELETE (전체) / 알림은 MySection (MY-03)
// 맞춤 추천 입력은 기록 안 함 (기록 저장은 상품 찾기 화면이 함)

// 저장된 조건 → 다시 검색할 주소 (모양이 틀리면 null)
// 상세 검색 조건: { q, target, purpose, … } (여러 값은 쉼표로 이은 글) / 간편 검색 조건: 키워드 목록
// 주소 값 검사(정해진 칩, 개수)는 상품 찾기 화면이 주소를 읽을 때 함
function getSearchPath(item) {
  let condition
  try {
    condition = typeof item.searchCondition === 'string' ? JSON.parse(item.searchCondition) : item.searchCondition
  } catch {
    return null
  }
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

  const reload = () => {
    setResult({ status: 'loading', items: [] })
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
      getItemLabel={(item) => item.searchLabel}
      renderItem={(item) => (
        <Chip $size="sm" onClick={() => handleSearch(item)}>
          {item.searchLabel}
        </Chip>
      )}
      onRemove={handleRemove}
      onClearAll={handleClearAll}
      emptyContent="최근 검색이 없어요"
      isInline
    />
  )
}

export default SearchHistoryList
