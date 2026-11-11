import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import useUiStore from '../../store/useUiStore'
import Toast from '../ui/Toast'
import Footer from './Footer'
import Header from './Header'
import MobileMenu from './MobileMenu'
import MobileTabBar from './MobileTabBar'

// LY-03 공통 틀: 상단바, 본문(Outlet), 푸터, 하단 탭바(모바일) 배치
// 화면 위에 뜨는 것(전체 메뉴, 알림)은 여기서 한 번만 그린다. (화면마다 따로 만들지 않음)
// TODO(CM-07, CM-09, CM-17, LY-09): 상품 상세 창, 비교함, 로그인 안내 창, 상시 도우미가 올라오면 여기서 그린다.
// TODO(ST-04, CM-07): useCompareStore가 올라오면 '담기 시작한 화면 밖 이동 막기(안내 알림)'를 넣고,
//   화면 이동 때 상세 창도 닫고, 상세 창·안내 창이 열려 있으면 뒤 화면 스크롤을 잠근다. (전체 메뉴 스크롤 잠금은 MobileMenu)
const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  @media (max-width: 899px) {
    padding-bottom: calc(66px + env(safe-area-inset-bottom));
  }
`

// 본문 최대 너비 1304, 좌우 여백 16 (768 이상 32) / 본문 위 40, 아래 120
const Main = styled.main`
  flex: 1;
  width: min(100% - 32px, 1304px);
  margin: 0 auto;
  padding: 40px 0 120px;
  @media (min-width: 768px) {
    width: min(100% - 64px, 1304px);
  }
`

function Layout() {
  const { pathname } = useLocation()
  const closeMenu = useUiStore((state) => state.closeMenu)

  // 화면 이동 시 열린 메뉴 닫기, 스크롤 맨 위로
  useEffect(() => {
    closeMenu()
    window.scrollTo(0, 0)
  }, [pathname, closeMenu])

  return (
    <Shell>
      <Header />
      <Main>
        <Outlet />
      </Main>
      <Footer />
      <MobileTabBar />
      <MobileMenu />
      <Toast />
    </Shell>
  )
}

export default Layout
