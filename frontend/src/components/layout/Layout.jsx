import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { getCompareProducts } from '../../api/productApi'
import useCompareStore, { getCompareBlock, getComparePage } from '../../store/useCompareStore'
import useUiStore from '../../store/useUiStore'
import { Button } from '../../styles/common'
import LoginRequiredDialog from '../common/LoginRequiredDialog'
import ProductDetailSheet from '../common/ProductDetailSheet'
import CompareCard from '../compare/CompareCard'
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
// 비교 화면의 한 칸 고르기(pickSlot)를 켜고 끄는 일, [+ 비교] 때의 확인 팝업(CompareConflictDialog)도 여기서 함
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

const DialogText = styled.p`
  margin-bottom: 20px;
  font-size: var(--fs-lg);
  font-weight: 700;
  white-space: pre-line;
`

const DialogActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
`

const DialogNote = styled.p`
  margin: -12px 0 16px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

const DialogCard = styled.div`
  margin-bottom: 20px;
`

const CONFLICT_REASON = {
  purpose: '방금 고른 상품은 자금 용도가 겹치지 않아 함께 비교할 수 없어요.',
  method: '방금 고른 상품은 상환 방식이 겹치지 않아 함께 비교할 수 없어요.',
}

// 비교 화면에 상품 하나가 담긴 채로(고르는 중 아님) 다른 상품의 [+ 비교]를 눌렀을 때 (useCompareStore의 pending)
// 담긴 상품을 받아 와서: 비교할 수 있으면 빈 칸에 담고 바로 비교 화면으로 / 자금 용도나 상환 방식이 안 맞으면 팝업
//   [담겨진 상품 뺄래요] → 담긴 상품을 빼고 방금 누른 상품을 A에 담아 비교 화면으로 / [담겨진 상품으로 비교] → 담긴 상품은 두고, 그 상품 기준으로 거른 상세 검색(고르는 중)으로
//   우측 상단 X, Esc, 바깥 클릭 → 닫기만 (아무것도 안 바뀜)
// 두 상품이 다 담겨 있을 때(pending.isFull)는 상품 정보 없이 경고만: [취소] / [비교하기](두 상품을 빼고 누른 상품을 A에 담아 비교 화면으로)
//   상품 상세 창에서 눌러도 위에 뜨게 isTop
function CompareConflictDialog() {
  const navigate = useNavigate()
  const pending = useCompareStore((state) => state.pending)
  const resolvePending = useCompareStore((state) => state.resolvePending)
  const clearPending = useCompareStore((state) => state.clearPending)
  const closeProduct = useUiStore((state) => state.closeProduct)
  // 비교할 수 없는 경우만 채움: { pending, product(담긴 상품), slot, block }
  const [conflict, setConflict] = useState(null)
  const isOpen = pending !== null && conflict?.pending === pending
  const isFullOpen = Boolean(pending?.isFull)

  useEffect(() => {
    if (!pending || pending.isFull) return undefined
    let isCancelled = false
    const { pair } = useCompareStore.getState()
    const slot = pair[0] === null ? 'B' : 'A'
    getCompareProducts([pair[0] ?? pair[1]])
      .then(([stored]) => {
        if (isCancelled) return
        // 담긴 상품을 더는 볼 수 없으면 비교할 수 없으니 새 상품으로 바꿈
        const isGone = !stored || stored.productStatus === 'HIDDEN'
        const block = isGone ? null : getCompareBlock(stored, pending.item)
        if (block === null) {
          resolvePending(!isGone)
          navigate('/compare')
          return
        }
        closeProduct()
        setConflict({ pending, product: stored, slot, block })
      })
      .catch(() => {
        if (isCancelled) return
        useUiStore.getState().showToast('담긴 상품을 확인하지 못했어요. 다시 눌러 주세요')
        clearPending()
      })
    return () => {
      isCancelled = true
    }
  }, [pending, navigate, resolvePending, clearPending, closeProduct])

  // 팝업이 열려 있는 동안 뒤 화면 스크롤 잠금
  useEffect(() => {
    if (!isOpen && !isFullOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, isFullOpen])

  const handleRemove = () => {
    resolvePending(false)
    navigate('/compare')
  }
  // 담긴 상품은 두고, 그 상품과 비교할 상품을 고르러 상세 검색으로 (비교 화면의 [비교 상품 고르기]와 같음: 담긴 상품 기준으로 거름)
  const handleKeep = () => {
    useCompareStore.getState().setPickSlot(conflict.slot === 'A' ? 'B' : 'A', conflict.product)
    clearPending()
    navigate('/search')
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={clearPending} label="담긴 상품 확인" width={480}>
        {isOpen && (
          <>
            <DialogText>이미 담겨 있는 상품이 있어요</DialogText>
            <DialogNote>{CONFLICT_REASON[conflict.block]}</DialogNote>
            <DialogCard>
              <CompareCard slot={conflict.slot} product={conflict.product} isReadOnly />
            </DialogCard>
            <DialogActions>
              <Button $variant="outline" onClick={handleRemove}>
                담겨진 상품 뺄래요
              </Button>
              <Button onClick={handleKeep}>담겨진 상품으로 비교</Button>
            </DialogActions>
          </>
        )}
      </Modal>
      <Modal isOpen={isFullOpen} onClose={clearPending} label="비교 상품 교체 확인" width={380} isTop showClose={false}>
        <DialogText>{'대출 비교에 담겨 있던 상품이 사라져요.\n비교하시겠어요?'}</DialogText>
        <DialogActions>
          <Button $variant="outline" onClick={clearPending}>
            취소
          </Button>
          <Button onClick={handleRemove}>비교하기</Button>
        </DialogActions>
      </Modal>
    </>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const closeMenu = useUiStore((state) => state.closeMenu)
  const closeProduct = useUiStore((state) => state.closeProduct)
  const closeRecommend = useUiStore((state) => state.closeRecommend)
  // 비교 화면의 한 칸을 고르는 중(pickSlot)은 비교할 수 있는 화면(상품 찾기, 맞춤 추천, 찜한 대출) 안에서만 이어짐
  // (자금 용도와 상환 방식이 맞으면 어느 화면의 상품이든 비교할 수 있어서 이 세 화면 사이는 끊지 않음)
  // 그 밖 화면(랭킹, 계산기, 마이페이지, 비교 화면 등)으로 가면 팝업 없이 끝냄(풀림). 비교 화면 상품은 그대로라 잃는 게 없음. 안 끝내면 나중에 그 화면을 열 때 'A 담음' 표시와 거르기가 남아 있음
  // 반대로 비교 화면에서 곧바로 그 세 화면으로 왔고 상품이 하나만 담겨 있으면 (버튼이든 메뉴든 똑같이) 고르는 중을 켬
  // 풀린 뒤에는 거르지 않고 전부 보이며, 안 맞는 상품의 [+ 비교]는 담긴 상품 확인 팝업 (CompareConflictDialog)
  const prevPathRef = useRef(pathname)
  useEffect(() => {
    const prevPath = prevPathRef.current
    prevPathRef.current = pathname
    const { pair, pickSlot, setPickSlot } = useCompareStore.getState()
    if (getComparePage(pathname) === null) {
      setPickSlot(null)
      return
    }
    // 비교 화면의 버튼으로 온 경우는 이미 켜져 있어서(pickSlot) 건너뜀
    const ids = pair.filter((id) => id !== null)
    if (prevPath !== '/compare' || pickSlot !== null || ids.length !== 1) return
    const emptySlot = pair[0] === null ? 'A' : 'B'
    getCompareProducts(ids)
      .then(([product]) => {
        const now = useCompareStore.getState()
        // 받는 사이에 다른 화면으로 갔거나 비교 화면 상품이 바뀌었으면 켜지 않음
        const isStale = now.pair !== pair || now.pickSlot !== null || getComparePage(window.location.pathname) === null
        if (isStale || !product || product.productStatus === 'HIDDEN') return
        now.setPickSlot(emptySlot, product)
      })
      // 못 받으면 켜지 않음 (풀린 상태와 같음: [+ 비교]를 누를 때 다시 확인함)
      .catch(() => {})
  }, [pathname])

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
    useCompareStore.getState().clearPending()
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
      <CompareConflictDialog />
      <RecommendDialog />
      <Toast />
    </Shell>
  )
}

export default Layout
