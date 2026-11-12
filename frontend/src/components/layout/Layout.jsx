import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import useUiStore from '../../store/useUiStore'
import ProductDetailSheet from '../common/ProductDetailSheet'
import Toast from '../ui/Toast'
import Footer from './Footer'
import Header from './Header'
import MobileMenu from './MobileMenu'
import MobileTabBar from './MobileTabBar'

// LY-03 공통 틀: 상단바, 본문(Outlet), 푸터, 하단 탭바(모바일) 배치
// 화면 위에 뜨는 것(전체 메뉴, 알림)은 여기서 한 번만 그린다. (화면마다 따로 만들지 않음)
// TODO(CM-09, CHORONG-47): 비교함 CompareTray가 올라오면 여기서 그린다.
// TODO(CM-17, CHORONG-43): 로그인 안내 창이 올라오면 여기서 그리고, 열려 있을 때 뒤 화면 스크롤을 잠근다. (상세 창은 ProductDetailSheet, 전체 메뉴는 MobileMenu가 잠금)
// TODO(LY-09, CHORONG-63): 상시 도우미 HelperPanel이 올라오면 여기서 그린다.
// TODO(ST-04, CHORONG-47): useCompareStore가 올라오면 '담기 시작한 화면 밖 이동 막기(안내 알림)'를 넣는다.
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
  flex: 1;
  width: min(100% - 32px, 1304px);
  margin: 0 auto;
  padding: 40px 0 120px;
  &:focus {
    outline: none;
  }
  @media (min-width: 768px) {
    width: min(100% - 64px, 1304px);
  }
  @media (max-width: 899px) {
    padding: 24px 0 calc(66px + 56px + env(safe-area-inset-bottom));
  }
`

function Layout() {
  const { pathname } = useLocation()
  const closeMenu = useUiStore((state) => state.closeMenu)
  const closeProduct = useUiStore((state) => state.closeProduct)

  // 화면 이동 시 열린 메뉴, 상품 상세 창 닫기, 스크롤 맨 위로
  useEffect(() => {
    closeMenu()
    closeProduct()
    window.scrollTo(0, 0)
  }, [pathname, closeMenu, closeProduct])

  return (
    <Shell>
      <SkipLink href="#main">본문 바로가기</SkipLink>
      <Header />
      <Main id="main" tabIndex={-1}>
        <Outlet />
      </Main>
      <Footer />
      <MobileTabBar />
      <MobileMenu />
      <ProductDetailSheet />
      <Toast />
    </Shell>
  )
}

export default Layout
