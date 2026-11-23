import { Outlet } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import RouteTabs from '../components/common/RouteTabs'

// SR-01 상품 찾기 화면: 제목 + 탭 2개 (간편 검색, 상세 검색 순서) + 탭 내용 (Outlet)
// /search/simple → 간편 검색 (SimpleSearch), /search → 상세 검색 (DetailSearch). 탭 내용은 App.jsx의 하위 Route가 정한다.
// 상단 메뉴, 탭바의 '상품 찾기'는 /search/simple로 열린다 (constants/menu.js)
const TABS = [
  { label: '간편 검색', to: '/search/simple' },
  { label: '상세 검색', to: '/search', end: true },
]

function SearchPage() {
  return (
    <>
      <PageHeader
        crumbs={['상품 찾기']}
        title="상품 찾기"
        description="조건을 골라 직접 좁히거나, 상황 키워드를 조합해 추천받으세요."
      />
      <RouteTabs tabs={TABS} label="찾는 방법" />
      <Outlet />
    </>
  )
}

export default SearchPage
