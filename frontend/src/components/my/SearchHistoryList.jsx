import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as myApi from '../../api/myApi'
import { Chip } from '../../styles/common'
import MySection from './MySection'

// MY-06 최근 검색 (검색 기록 10개): 칩 (칩마다 X) / 지우기
// 칩 X → API-22 DELETE /{searchId} (404면 목록 다시 불러옴) / 지우기 → API-22 DELETE (전체) / 알림은 MySection (MY-03)
// 맞춤 추천 입력은 기록 안 함 (기록 저장은 상품 찾기 화면이 함)
// TODO(MY-06, SR, CHORONG-64 조빌립): 칩 누르면 상세 검색 /search?{조건}, 간편 검색 /search/simple?kw= 로 다시 검색.
//   searchCondition(조건 JSON 글) 모양은 상품 찾기가 postSearch로 저장할 때 정해짐 → 정해지면 주소 값을 붙인다. (지금은 그 화면으로 이동만)
// TODO(API-22, CHORONG-42 BE): 최근 검색 API는 오늘 서버 범위 밖이라 지금은 실패 문구가 뜸
function SearchHistoryList() {
  const navigate = useNavigate()
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

  const handleSearch = (item) => navigate(item.searchType === 'SIMPLE' ? '/search/simple' : '/search')

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
