import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import useUiStore from './useUiStore'

// ST-04 비교함
// tray: 담는 중 상품 { productId, companyName, productName, purposes } (최대 2, 첫 상품 = 자금 용도 기준)
// pair: 비교 화면 두 상품 번호 [A, B] (빈 칸은 null) / swapSlot: 바꿀 칸 (null, 'A', 'B') / from: 담기 시작한 화면 주소
// 저장: tray, pair만 sessionStorage (탭 닫으면 삭제). swapSlot, from은 메모리만
// TODO(ST-01, CHORONG-43): 로그아웃, 탈퇴 때 비우기 (useAuthStore 쪽에서 clearTray()와 setPair(null, null) 호출). 401에는 그대로 둔다.

const MAX_TRAY = 2
const SAME_PURPOSE_MESSAGE = '자금 용도가 같은 상품끼리만 비교할 수 있어요'

// 비교함을 쓸 수 있는 화면 묶음: 맞춤 추천 / 상품 찾기. 그 밖 화면(랭킹 등)에서는 비교 안 함
export function getComparePage(pathname) {
  if (typeof pathname !== 'string') return null
  if (pathname === '/recommend' || pathname.startsWith('/recommend/')) return 'recommend'
  if (pathname === '/search' || pathname.startsWith('/search/')) return 'search'
  return null
}

// 비교함에 담긴 상품이 화면에서 A, B 어느 칸인지 (바꿀 칸이 A이면 남긴 상품이 B, 새 상품이 A)
export function getTraySlot(tray, swapSlot, productId) {
  const index = tray.findIndex((item) => item.productId === productId)
  if (index < 0) return null
  return (swapSlot === 'A' ? 1 - index : index) === 1 ? 'B' : 'A'
}

// 상품의 자금 용도 목록 (tray 상품은 purposes, 상품 요약/상세는 tags의 PURPOSE)
export function getPurposes(product) {
  if (!product) return []
  if (Array.isArray(product.purposes)) return product.purposes
  return (product.tags ?? []).filter((tag) => tag.tagType === 'PURPOSE').map((tag) => tag.tagValue)
}

// 자금 용도가 하나라도 겹치는지 (E15). 용도를 모르는 상품은 겹치지 않는 것으로 본다.
export function hasSamePurpose(productA, productB) {
  const purposesB = getPurposes(productB)
  return getPurposes(productA).some((purpose) => purposesB.includes(purpose))
}

// ProductSummaryDTO (또는 상세)에서 비교함에 담을 값만 뽑음
function toTrayItem(product) {
  return {
    productId: product.productId,
    companyName: product.companyName,
    productName: product.productName,
    purposes: getPurposes(product),
  }
}

const useCompareStore = create(
  persist(
    (set, get) => ({
      tray: [],
      pair: [null, null],
      swapSlot: null,
      from: null,
      // 비교함 흔들기 신호 (이동을 막았을 때 CompareTray가 한 번 흔들림). 메모리만, 저장 안 함
      shakeCount: 0,

      // E15 비교 가능 검사: other를 안 주면 비교함 첫 상품과 비교 (비교함이 비어 있으면 늘 true)
      canCompare: (product, other) => {
        const base = other ?? get().tray[0]
        if (!base) return true
        return hasSamePurpose(product, base)
      },

      // 비교함에 담기. 담거나 B를 바꾸면 true, 못 담으면 false (알림도 여기서 띄움)
      // 이미 담긴 상품이면 빼고 false
      addTray: (product) => {
        const { tray, canCompare } = get()
        const { showToast } = useUiStore.getState()

        if (tray.some((item) => item.productId === product.productId)) {
          const slot = getTraySlot(tray, get().swapSlot, product.productId)
          get().removeTray(product.productId)
          showToast(`${slot}에서 뺐어요`)
          return false
        }

        if (!canCompare(product)) {
          showToast(SAME_PURPOSE_MESSAGE)
          return false
        }

        const item = toTrayItem(product)
        if (tray.length === 0) {
          set({ tray: [item], from: window.location.pathname })
          showToast(`A에 담았어요. 자금 용도(${item.purposes.join('·')})가 겹치는 상품만 비교할 수 있어요`)
        } else if (tray.length < MAX_TRAY) {
          set({ tray: [...tray, item] })
          showToast(`${get().swapSlot === 'A' ? 'A' : 'B'}에 담았어요. 비교하기를 눌러 보세요`)
        } else {
          set({ tray: [tray[0], item] })
          showToast('B를 바꿨어요')
        }
        return true
      },

      removeTray: (id) => {
        const next = get().tray.filter((item) => item.productId !== id)
        // 상품을 하나라도 빼면 '바꿀 칸' 기억은 끝 (남긴 상품이 빠졌을 수 있어 순서를 믿을 수 없음)
        set(next.length === 0 ? { tray: [], swapSlot: null, from: null } : { tray: next, swapSlot: null })
      },

      shakeTray: () => set((state) => ({ shakeCount: state.shakeCount + 1 })),

      clearTray: () => set({ tray: [], swapSlot: null, from: null }),

      // 비교하기: tray → pair로 옮기고 tray 비움 (바꿀 칸이 있으면 그 칸에 새 상품, 남긴 상품은 다른 칸)
      goCompare: () => {
        const { tray, swapSlot } = get()
        if (tray.length < MAX_TRAY) return
        const [first, second] = tray.map((item) => item.productId)
        const pair = swapSlot === 'A' ? [second, first] : [first, second]
        set({ pair, tray: [], swapSlot: null, from: null })
      },

      setPair: (idA, idB) => set({ pair: [idA, idB] }),

      // 빈 칸 먼저, 둘 다 차 있으면 B를 바꿈
      putPair: (id) => {
        const [idA, idB] = get().pair
        if (idA === null) set({ pair: [id, idB] })
        else if (idB === null) set({ pair: [idA, id] })
        else set({ pair: [idA, id] })
      },

      clearSlot: (slot) => {
        const [idA, idB] = get().pair
        set({ pair: slot === 'A' ? [null, idB] : [idA, null] })
      },

      // 남길 상품(상세 또는 요약, 없으면 null)만 비교함에 두고 바꿀 칸을 기억. 상품 찾기로 가서 새 상품을 고름
      // (명세서 startSwap('A' 또는 'B')에 남길 상품을 받는 두 번째 값을 더함: 용도 필터에 그 상품의 용도가 필요해서)
      startSwap: (slot, keepProduct = null) =>
        set({
          tray: keepProduct ? [toTrayItem(keepProduct)] : [],
          swapSlot: slot,
          from: '/search',
        }),
    }),
    {
      name: 'chorong-compare',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ tray: state.tray, pair: state.pair }),
    },
  ),
)

export default useCompareStore
