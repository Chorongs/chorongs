import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import useCompareStore, { getComparePage } from '../../store/useCompareStore'
import useUiStore from '../../store/useUiStore'
import CompareTray from '../common/CompareTray'
import LoginRequiredDialog from '../common/LoginRequiredDialog'
import ProductDetailSheet from '../common/ProductDetailSheet'
import RecommendDialog from '../recommend/RecommendDialog'
import Toast from '../ui/Toast'
import { LogoutDialog } from './AccountMenu'
import Footer from './Footer'
import Header from './Header'
import MobileMenu from './MobileMenu'
import MobileTabBar from './MobileTabBar'

// LY-03 공통 틀: 상단바, 본문(Outlet), 푸터, 하단 탭바(모바일) 배치
// 화면 위에 뜨는 것(전체 메뉴, 알림)은 여기서 한 번만 그린다. (화면마다 따로 만들지 않음)
// 비교함에 상품이 있으면 담기 시작한 화면(맞춤 추천, 상품 찾기, 찜한 대출) 밖으로 이동하지 못하게 막고 안내 알림을 띄운다. (되돌아가는 방식)
// 로그인 안내 창(CM-17)도 여기서 그림 (열려 있을 때 뒤 화면 스크롤 잠금은 LoginRequiredDialog가 함)
// 로그아웃 창(LY-08, MY-02 같이 씀)도 여기서 그림 (상단바 안에서 그리면 하단 탭바, 비교함 띠 아래에 깔림. UI-15 Layout에서 그림)
// 맞춤 추천 창(RC-14)도 여기서 그림 (열림 상태는 useUiStore의 recommendOpen, recommendSkipGate)
// 본문 오른쪽에는 300px 칸(#page-side)이 있다: 화면(예: 대출 비교의 '비교할 상품 고르기')이 portal로 내용을 끼워 넣고, 칸이 비어 있으면 안 보인다. (1180 미만은 본문 아래)
// TODO(LY-09, CHORONG-63 김채희): 상시 도우미 HelperPanel이 올라오면 #page-side 칸 안, 끼워 넣은 내용 아래에 그린다. (칸은 도우미가 열려 있거나 끼워 넣은 내용이 있을 때 보이게 바꾼다)
const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`

// 키보드 사용자를 위한 '본문 바로가기' (평소엔 화면 밖, 포커스를 받으면 나타남)
const SkipLink = styled.a`
  position: absolute;
  top: -60px;
  left: 12px;
  z-index: 100;
  padding: 10px 14px;
  border-radius: var(--r-sm);
  background: var(--ink);
  color: var(--paper);
  font-weight: 700;
  &:focus {
    top: 12px;
  }
`

// 본문 최대 너비 1304, 좌우 여백 16 (768 이상 32) / 본문 위 40, 아래 120 (모바일: 위 24, 아래는 탭바 66 + 56)
const Main = styled.main`
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
  width: min(100% - 32px, 1304px);
  margin: 0 auto;
  padding: 40px 0 120px;
  &:focus {
    outline: none;
  }
  @media (min-width: 768px) {
    width: min(100% - 64px, 1304px);
  }
  /* 오른쪽 칸에 내용이 있을 때만 2열 (본문 + 300, 사이 간격 48) */
  @media (min-width: 1180px) {
    &:has(> aside:not(:empty)) {
      grid-template-columns: minmax(0, 1fr) 300px;
      column-gap: 48px;
      align-items: start;
    }
  }
  @media (max-width: 899px) {
    padding: 24px 0 calc(66px + 56px + env(safe-area-inset-bottom));
  }
`

// 본문 칸 (오른쪽 칸과 나란히 놓기 위해 감쌈)
const Content = styled.div`
  min-width: 0;
`

// 본문 오른쪽 칸: 화면이 내용을 끼워 넣는 자리 (위: 화면 내용, 아래: 상시 도우미)
const Side = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  &:empty {
    display: none;
  }
`

// 비교함을 담기 시작한 화면 묶음 이름 (이동을 막을 때 알림 글)
const COMPARE_PAGE_LABEL = { recommend: '추천 결과', search: '상품 찾기', liked: '찜한 대출' }

function Layout() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const closeMenu = useUiStore((state) => state.closeMenu)
  const closeProduct = useUiStore((state) => state.closeProduct)
  const closeRecommend = useUiStore((state) => state.closeRecommend)
  const showToast = useUiStore((state) => state.showToast)
  // 비교함 때문에 허용된 마지막 주소 (막았을 때 여기로 되돌아감, 상품 찾기 조건은 ? 뒤에 있어 search까지 기억)
  const lastAllowedRef = useRef(null)

  // 비교함 이동 막기: 담기 시작한 화면과 다른 화면 묶음으로 가면 되돌림 (랭킹 등 비교 안 하는 화면도 막음)
  useEffect(() => {
    const { tray, from } = useCompareStore.getState()
    const isBlocked = tray.length > 0 && from !== null && getComparePage(pathname) !== getComparePage(from)
    if (isBlocked) {
      navigate(lastAllowedRef.current ?? from, { replace: true })
      showToast(`${COMPARE_PAGE_LABEL[getComparePage(from)] ?? '상품 찾기'}에서 담은 비교함이 있어요. [비교하기]를 누르거나 비교함을 비운 뒤 이동해 주세요`)
      useCompareStore.getState().shakeTray()
    } else {
      lastAllowedRef.current = `${pathname}${search}`
    }
  }, [pathname, search, navigate, showToast])

  // 화면 이동 시 열린 메뉴, 상품 상세 창, 추천 창 닫기, 스크롤 맨 위로
  useEffect(() => {
    closeMenu()
    closeProduct()
    closeRecommend()
    window.scrollTo(0, 0)
  }, [pathname, closeMenu, closeProduct, closeRecommend])

  return (
    <Shell>
      <SkipLink href="#main">본문 바로가기</SkipLink>
      <Header />
      <Main id="main" tabIndex={-1}>
        <Content>
          <Outlet />
        </Content>
        <Side id="page-side" />
      </Main>
      <Footer />
      <MobileTabBar />
      <MobileMenu />
      <ProductDetailSheet />
      <LoginRequiredDialog />
      <LogoutDialog />
      <CompareTray />
      <RecommendDialog />
      <Toast />
    </Shell>
  )
}

export default Layout
