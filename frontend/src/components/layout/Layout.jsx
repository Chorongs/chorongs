import { useEffect, useState } from 'react'
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

// 담긴 상품이 있는데(고르는 중 아님) 다른 상품의 [+ 비교]를 눌렀을 때 (useCompareStore의 pending). 담긴 A 상품(A가 비었으면 B)을 받아 옴
//   하나만 담김: 비교할 수 있으면 팝업 없이 빈 칸에 담고 비교 화면으로 / 자금 용도나 상환 방식이 안 맞으면 팝업
//   두 상품이 다 담김(pending.isFull): 맞든 안 맞든 같은 팝업 (A 상품 기준)
//   두 상품이 다 담긴 상태에서 B 상품을 누름(pending.isSameB): B 상품 카드 팝업, [이 상품 기준으로 새로 비교]만 → 그 상품을 A로 옮기고(지금 A는 빠짐) B를 고르는 중
// 팝업: 담긴 상품 카드 + [새로 담기] → 담긴 상품을 모두 빼고 방금 누른 상품을 A에 담아 비교 화면으로
//   [이 상품으로 비교] → 그 상품은 두고, 그 상품 기준으로 거른 상세 검색(고르는 중)으로. 두 개 담겼으면 거기서 고른 상품이 B를 바꿈
//   우측 상단 X, Esc, 바깥 클릭 → 닫기만 (아무것도 안 바뀜)
function CompareConflictDialog() {
  const navigate = useNavigate()
  const pending = useCompareStore((state) => state.pending)
  const resolvePending = useCompareStore((state) => state.resolvePending)
  const clearPending = useCompareStore((state) => state.clearPending)
  const closeProduct = useUiStore((state) => state.closeProduct)
  // 팝업을 띄울 때만 채움: { pending, product(담긴 상품), slot, block(안 맞는 이유, 맞으면 null) }
  const [conflict, setConflict] = useState(null)
  const isOpen = pending !== null && conflict?.pending === pending

  useEffect(() => {
    if (!pending) return undefined
    let isCancelled = false
    const { pair } = useCompareStore.getState()
    // 카드에 보여 줄 칸: B 상품을 눌렀거나 B만 담겼으면 B, 나머지는 A
    const slot = pending.isSameB || pair[0] === null ? 'B' : 'A'
    getCompareProducts([pair[slot === 'A' ? 0 : 1]])
      .then(([stored]) => {
        if (isCancelled) return
        // 담긴 상품을 더는 볼 수 없으면 비교할 수 없으니 새 상품으로 바꿈
        const isGone = !stored || stored.productStatus === 'HIDDEN'
        const block = isGone || pending.isSameB ? null : getCompareBlock(stored, pending.item)
        if (block === null && !pending.isFull && !pending.isSameB) {
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
    if (!isOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  const handleRemove = () => {
    resolvePending(false)
    navigate('/compare')
  }
  // 담긴 상품은 두고, 그 상품과 비교할 상품을 고르러 상세 검색으로 (비교 화면의 [비교 상품 고르기]와 같음: 담긴 상품 기준으로 거름)
  const handleKeep = () => {
    // B 상품을 누른 경우: 그 상품을 A로 옮기고 B를 고름
    if (conflict.pending.isSameB) useCompareStore.getState().setPair(conflict.product.productId, null)
    useCompareStore.getState().setPickSlot(conflict.pending.isSameB || conflict.slot === 'A' ? 'B' : 'A', conflict.product)
    clearPending()
    navigate('/search')
  }

  return (
    <Modal isOpen={isOpen} onClose={clearPending} label="담긴 상품 확인" width={480}>
      {isOpen && (
        <>
          <DialogText>{conflict.pending.isSameB ? '이미 상품이 B에 담겨 있어요' : '이미 담겨 있는 상품이 있어요'}</DialogText>
          {conflict.block && <DialogNote>{CONFLICT_REASON[conflict.block]}</DialogNote>}
          {conflict.pending.isSameB && (
            <DialogNote>
              A에 있던 상품은 빠지고 이 상품이 A가 돼요.
              <br />
              그다음 B에 넣을 상품을 새로 골라요.
            </DialogNote>
          )}
          <DialogCard>
            <CompareCard slot={conflict.slot} product={conflict.product} isReadOnly />
          </DialogCard>
          <DialogActions>
            {!conflict.pending.isSameB && (
              <Button $variant="outline" onClick={handleRemove}>
                새로 담기
              </Button>
            )}
            {/* 담긴 상품을 더는 볼 수 없으면 기준이 못 돼서 빼기만 */}
            {conflict.product?.productStatus !== 'HIDDEN' && (
              <Button onClick={handleKeep}>{conflict.pending.isSameB ? '이 상품 기준으로 새로 비교' : '이 상품으로 비교'}</Button>
            )}
          </DialogActions>
        </>
      )}
    </Modal>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const closeMenu = useUiStore((state) => state.closeMenu)
  const closeProduct = useUiStore((state) => state.closeProduct)
  const closeRecommend = useUiStore((state) => state.closeRecommend)
  // 비교 화면의 한 칸을 고르는 중(pickSlot)은 버튼([비교 상품 고르기], [다른 상품으로 비교], 팝업의 [이 상품으로 비교])을 눌렀을 때만 켜짐
  // (메뉴로 이동해서는 켜지지 않음: 직전 화면에 따라 켜지면 같은 메뉴를 눌러도 결과가 달라져서 헷갈림)
  // 켜진 뒤에는 비교할 수 있는 화면(상품 찾기, 맞춤 추천, 찜한 대출) 안에서만 이어짐
  // (자금 용도와 상환 방식이 맞으면 어느 화면의 상품이든 비교할 수 있어서 이 세 화면 사이는 끊지 않음)
  // 그 밖 화면(랭킹, 계산기, 마이페이지, 비교 화면 등)으로 가면 팝업 없이 끝냄(풀림). 비교 화면 상품은 그대로라 잃는 게 없음. 안 끝내면 나중에 그 화면을 열 때 'A 담음' 표시와 거르기가 남아 있음
  // 풀린 뒤에는 거르지 않고 전부 보이며, 안 맞는 상품의 [+ 비교]는 담긴 상품 확인 팝업 (CompareConflictDialog)
  useEffect(() => {
    if (getComparePage(pathname) === null) useCompareStore.getState().setPickSlot(null)
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
