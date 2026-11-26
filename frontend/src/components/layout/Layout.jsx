import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { getCompareProducts } from '../../api/productApi'
import useCompareStore, { getComparePage, isComparing } from '../../store/useCompareStore'
import useUiStore from '../../store/useUiStore'
import { Button } from '../../styles/common'
import LoginRequiredDialog from '../common/LoginRequiredDialog'
import ProductDetailSheet from '../common/ProductDetailSheet'
import RecommendDialog from '../recommend/RecommendDialog'
import Modal from '../ui/Modal'
import Toast from '../ui/Toast'
import { LogoutDialog } from './AccountMenu'
import Footer from './Footer'
import Header from './Header'
import MobileMenu from './MobileMenu'
import MobileTabBar from './MobileTabBar'

// LY-03 공통 틀: 상단바, 본문(Outlet), 푸터, 하단 탭바(모바일) 배치
// 화면 위에 뜨는 것(전체 메뉴, 알림)은 여기서 한 번만 그린다. (화면마다 따로 만들지 않음)
// 비교 화면의 한 칸 고르기(pickSlot)를 끄는 일, 비교 화면을 벗어날 때 담긴 상품을 비우는 일도 여기서 함
// 로그인 안내 창(CM-17)도 여기서 그림 (열려 있을 때 뒤 화면 스크롤 잠금은 LoginRequiredDialog가 함)
// 로그아웃 창(LY-08, MY-02 같이 씀)도 여기서 그림 (상단바 안에서 그리면 하단 탭바 아래에 깔림. UI-15 Layout에서 그림)
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

// $isThin: 상품 찾기에서 뜨는 확인 창은 제목을 덜 굵게
const DialogText = styled.p`
  margin-bottom: 24px;
  font-size: var(--fs-h4);
  font-weight: ${({ $isThin }) => ($isThin ? 700 : 800)};
  line-height: 1.45;
  word-break: keep-all;
`

const DialogNote = styled.p`
  margin: -12px 0 24px;
  color: var(--cocoa);
  font-size: var(--fs-lg);
  word-break: keep-all;
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

// 화면을 옮겨도 비교 화면 상품을 남기는 경우: 비교 화면으로 감 / 고르러 나간 중 상품 찾기(상세 검색, 간편 검색) 안
// (맞춤 추천, 찜한 대출, 계산기 등은 모두 벗어나는 것)
function keepsCompare(to, isPicking) {
  return to === '/compare' || (isPicking && getComparePage(to) === 'search')
}

// 담은 상품이 사라지는 곳으로 가려 하면 먼저 확인
function needsLeaveConfirm(from, to) {
  return isComparing(from) && !keepsCompare(to, useCompareStore.getState().pickSlot !== null)
}

// 대출 비교 벗어나기 확인 창: [아니오], X, Esc, 바깥 클릭 → 그대로 / [예] → 담은 상품을 비우고 하려던 동작(이동, 추천 창, 로그아웃)을 이어서 함
// 비교 화면에서 두 상품이 다 담겼고 아직 저장 전이면 [결과 저장] 안내도 함께 보여 줌 (고르러 나온 화면에는 그 버튼이 없음)
function CompareLeaveDialog() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const leaveTo = useUiStore((state) => state.compareLeaveTo)
  const leaveState = useUiStore((state) => state.compareLeaveState)
  const closeCompareLeave = useUiStore((state) => state.closeCompareLeave)
  const canSave = useCompareStore(
    (state) => state.pair.every((id) => id !== null) && state.savedKey !== `${state.pair[0]}-${state.pair[1]}`,
  )
  const isOpen = leaveTo !== null

  // 팝업이 열려 있는 동안 뒤 화면 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  const handleLeave = () => {
    const { compareLeaveElement } = useUiStore.getState()
    useCompareStore.getState().setPickSlot(null)
    useCompareStore.getState().setPair(null, null)
    closeCompareLeave()
    // 눌렀던 것이 아직 있으면 다시 눌러 원래 동작을 그대로 하고, 없으면(뒤로 가기, 닫힌 메뉴) 주소로 이동
    if (compareLeaveElement?.isConnected) compareLeaveElement.click()
    else navigate(leaveTo, { state: leaveState })
  }

  return (
    // isTop: 상품 상세 창 안의 [이자 계산]에서도 뜨므로 그 창 위에
    <Modal isTop isOpen={isOpen} onClose={closeCompareLeave} label="대출 비교 벗어나기 확인" width={pathname.startsWith('/search') ? 480 : 420}>
      {isOpen && (
        <>
          <DialogText $isThin={pathname.startsWith('/search')}>
            {pathname.startsWith('/search') ? (
              <>
                페이지를 벗어나면 비교 중이던 상품이 사라져요.
                <br />
                이동하시겠어요?
              </>
            ) : (
              '비교 중인 상품이 사라져요. 이동할까요?'
            )}
          </DialogText>
          {canSave && pathname === '/compare' && (
            <DialogNote>내역을 저장하려면 [아니오]를 누른 뒤 [결과 저장]을 눌러 주세요.</DialogNote>
          )}
          <DialogActions>
            <Button onClick={handleLeave}>예</Button>
            <Button $variant="outline" onClick={closeCompareLeave}>
              아니오
            </Button>
          </DialogActions>
        </>
      )}
    </Modal>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const closeMenu = useUiStore((state) => state.closeMenu)
  const closeProduct = useUiStore((state) => state.closeProduct)
  const closeRecommend = useUiStore((state) => state.closeRecommend)
  const openCompareLeave = useUiStore((state) => state.openCompareLeave)

  // 링크(메뉴, 탭바, 푸터 등)와 data-leave-to를 붙인 버튼(로그인, 상세 창 [이자 계산])은 누른 순간 멈추고 확인 창을 띄움
  // (새 탭으로 여는 클릭은 벗어나는 것이 아니라 그대로, 다른 사이트 링크는 아래 beforeunload가 맡음)
  useEffect(() => {
    const handleClick = (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target.closest?.('a[href], [data-leave-to]')
      if (!target || target.target === '_blank') return
      const isLink = target.matches('a[href]')
      if (isLink && target.origin !== window.location.origin) return
      const to = isLink ? `${target.pathname}${target.search}` : target.dataset.leaveTo
      if (!needsLeaveConfirm(pathname, to.split('?')[0])) return
      event.preventDefault()
      event.stopPropagation() // 추천 창 열기, 로그아웃 같은 원래 동작은 [예] 뒤에
      // 포커스를 풀지 않으면 창이 닫힐 때 눌렀던 메뉴로 포커스가 돌아가 상단 하위 메뉴가 펼쳐짐
      target.blur()
      openCompareLeave(to, null, target)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname, openCompareLeave])

  // 탭 닫기, 새로고침, 주소창 이동은 브라우저 기본 확인 창 (문구는 바꿀 수 없음)
  // 로그인 안내 창에서 소셜 로그인으로 가는 길([결과 저장])은 돌아와서 이어 하므로 묻지 않음
  useEffect(() => {
    const handleUnload = (event) => {
      if (!isComparing(pathname) || useUiStore.getState().loginDialogOpen) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [pathname])

  // 비교 화면의 한 칸을 고르는 중(pickSlot)은 버튼([비교 상품 고르기], [다른 상품으로 비교])을 눌렀을 때만 켜지고,
  // 상품 찾기(상세 검색, 간편 검색) 안에서만 이어짐. 그 밖 화면으로 가면 끝
  // 비교 화면 상품은 벗어나면 사라짐 (남기는 경우는 keepsCompare). 남기고 싶으면 [결과 저장]
  // 주소창으로 다른 화면을 새로 연 것도 벗어난 것. 새로고침(/compare)과 소셜 로그인에서 돌아오는 길(/oauth, /login)은 남김
  const prevPathRef = useRef(null)
  useEffect(() => {
    const from = prevPathRef.current
    prevPathRef.current = pathname
    const isMoved = from !== null && from !== pathname
    // 뒤로 가기처럼 링크가 아닌 이동은 막을 수 없어서, 있던 화면으로 되돌린 뒤 확인 창을 띄움
    // (상품 상세 창의 [이자 계산]처럼 값을 넘기는 이동은 [예] 뒤에도 그 값을 넘김. 상품 찾기의 조건은 SearchPage가 복원)
    if (isMoved && needsLeaveConfirm(from, pathname)) {
      openCompareLeave(`${window.location.pathname}${window.location.search}`, window.history.state?.usr ?? null)
      navigate(from, { replace: true })
      return
    }
    const { pickSlot, setPickSlot, setPair } = useCompareStore.getState()
    if (getComparePage(pathname) !== 'search') setPickSlot(null)
    const isLoginReturn = from === null && (pathname.startsWith('/oauth') || pathname.startsWith('/login'))
    if (from !== pathname && !isLoginReturn && !keepsCompare(pathname, pickSlot !== null)) setPair(null, null)
  }, [pathname, navigate, openCompareLeave])

  // 고르는 중이면 남겨 둔 상품의 상세를 받아 둠 (상품 찾기가 검색 결과 맨 위에 고정해 보여 줌)
  const pickBaseId = useCompareStore((state) => (state.pickSlot !== null ? (state.pickBase?.productId ?? null) : null))
  useEffect(() => {
    if (pickBaseId === null) return undefined
    let isCancelled = false
    getCompareProducts([pickBaseId])
      .then(([product]) => {
        if (!isCancelled) useCompareStore.getState().setPickProduct(product ?? null)
      })
      // 못 받으면 고정만 안 함 (목록은 그대로)
      .catch(() => {})
    return () => {
      isCancelled = true
    }
  }, [pickBaseId])

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
      <CompareLeaveDialog />
      <RecommendDialog />
      <Toast />
    </Shell>
  )
}

export default Layout
