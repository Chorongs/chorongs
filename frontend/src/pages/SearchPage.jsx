import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import RouteTabs from '../components/common/RouteTabs'

// SR-01 상품 찾기 화면: 제목 + 탭 2개 (상세 검색, 간편 검색 순서) + 탭 내용 (Outlet)
// /search/simple → 간편 검색 (SimpleSearch), /search → 상세 검색 (DetailSearch). 탭 내용은 App.jsx의 하위 Route가 정한다.
// 상단 메뉴, 탭바의 '상품 찾기'는 /search(상세 검색)로 열린다 (constants/menu.js)
// 검색 조건(주소 ? 뒤: 상세 검색의 필터, 간편 검색의 키워드) 기억 (요청서 A15):
//   - 탭마다 마지막 주소의 ? 뒤를 sessionStorage에 저장해 두고 (탭 닫으면 사라짐, 비교함과 같음)
//   - 탭을 옮겨 다닐 때 탭 링크에 붙이고, 다른 화면에 갔다가 상품 찾기를 다시 열 때 (주소에 조건이 없으면) 그 조건으로 복원한다.
//   - 주소에 조건이 있으면(링크, 최근 검색 칩, 신용 진단 링크 등) 그 조건이 우선. 화면의 [초기화]로 비우면 빈 조건이 저장됨
const STORAGE_KEY = 'searchTabQuery'
const QUERY_MAX = 2000

// 저장된 ? 뒤 글: '?'로 시작하는 짧은 글만 씀 (사람이 저장소를 고쳤을 때를 대비)
const cleanQuery = (value) => (typeof value === 'string' && value.length <= QUERY_MAX && /^\?[^#]*$/.test(value) ? value : '')

function readSaved() {
  try {
    const data = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    return { simple: cleanQuery(data?.simple), detail: cleanQuery(data?.detail) }
  } catch {
    return { simple: '', detail: '' }
  }
}

function SearchPage() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const currentTab = pathname.startsWith('/search/simple') ? 'simple' : 'detail'
  const didRestore = useRef(false)

  // 처음 열 때 한 번: 주소에 조건이 없으면 저장된 조건으로 복원 (저장 effect보다 먼저 선언해야 함)
  useEffect(() => {
    if (didRestore.current) return
    didRestore.current = true
    const savedQuery = readSaved()[currentTab]
    if (!search && savedQuery) navigate(`${pathname}${savedQuery}`, { replace: true })
  }, [currentTab, navigate, pathname, search])

  // 조건이 바뀔 때마다 지금 탭의 조건 저장 (저장소를 못 쓰는 환경이면 그냥 넘어감)
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSaved(), [currentTab]: cleanQuery(search) }))
    } catch {
      // 저장소를 못 써도 화면은 그대로 동작
    }
  }, [currentTab, search])

  // 탭 링크: 지금 탭은 지금 주소의 조건, 다른 탭은 저장된 조건
  const saved = readSaved()
  const tabs = [
    { label: '상세 검색', to: `/search${currentTab === 'detail' ? search : saved.detail}`, end: true },
    { label: '간편 검색', to: `/search/simple${currentTab === 'simple' ? search : saved.simple}` },
  ]

  return (
    <>
      <PageHeader
        crumbs={['상품 찾기']}
        title="상품 찾기"
        description="조건을 골라 직접 좁히거나, 상황 키워드를 조합해 추천받으세요."
      />
      <RouteTabs tabs={tabs} label="찾는 방법" />
      <Outlet />
    </>
  )
}

export default SearchPage
