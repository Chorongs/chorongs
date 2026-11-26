import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getSupportedMethods, REPAY_METHODS } from '../utils/loanMath'
import useUiStore from './useUiStore'

// ST-04 비교 화면 상품 (하단 비교함은 없앰, CHORONG-82)
// pair: 비교 화면 두 상품 번호 [A, B] (빈 칸은 null)
// pickSlot, pickBase: 비교 화면의 한 칸을 고르러 상품 찾기, 맞춤 추천, 찜한 대출로 나온 중인 칸과 그때 남은 상품
//   { productId, companyName, productName, purposes, methods } (명세서 ST-04에 없는 값)
// pickProduct: 남은 상품 상세 (검색 결과 맨 위 고정용)
// userAmount: 비교 화면에서 직접 바꾼 빌릴 금액(만원, 안 바꿨으면 null). 비교를 비우면 같이 비움 (명세서 ST-04에 없는 값)
// 비교 화면을 벗어나면 담긴 상품은 사라짐 (고르러 나간 중은 남김, 지우는 곳은 Layout)
// savedKey: 방금 저장한 조합 'A번호-B번호' ([결과 저장] 버튼을 '저장했어요'로 잠금). 비교를 비우면 같이 비움 (명세서 ST-04에 없는 값)
// 저장: pair, pickSlot, pickBase, userAmount, savedKey만 sessionStorage (탭 닫으면 삭제)
// 로그아웃, 탈퇴 때 useAuthStore, MemberInfo가 setPair(null, null)과 setPickSlot(null)로 비움. 401에는 그대로 둔다

const SAME_PURPOSE_MESSAGE = '자금 용도가 같은 상품끼리만 비교할 수 있어요'
const SAME_METHOD_MESSAGE = '상환 방식이 겹치는 상품끼리만 비교할 수 있어요'
// 비교할 상품을 담을 수 있는 화면 묶음: 맞춤 추천 / 상품 찾기 / 찜한 대출(MY). 그 밖 화면(랭킹 등)에서는 비교 안 함
export function getComparePage(pathname) {
  if (typeof pathname !== 'string') return null
  if (pathname === '/my/liked' || pathname.startsWith('/my/liked/')) return 'liked'
  if (pathname === '/recommend' || pathname.startsWith('/recommend/')) return 'recommend'
  if (pathname === '/search' || pathname.startsWith('/search/')) return 'search'
  return null
}

// 용도, 상환 방식이 겹치는 상품만 보이게 거르는 기준 상품 (상품 찾기, 맞춤 추천의 거르기, 필터 띠, '비교 불가' 표시가 씀)
// 비교 화면의 한 칸을 고르러 나온 중 남은 상품(pickBase), 없으면 null
export function getCompareBase(state) {
  return state.pickBase ?? null
}

// 비교 화면 한 칸을 고르러 나온 중이면, 남겨 둔 상품이 비교 화면에서 A, B 어느 칸인지 (그 상품이 아니면 null). 상품 줄, 카드에 'A 담음' 표시용
export function getPickBaseSlot(state, productId) {
  if (state.pickSlot === null || state.pickBase?.productId !== productId) return null
  return state.pickSlot === 'A' ? 'B' : 'A'
}

// 고르는 중에 검색 결과 맨 위에 고정할 상품 (남겨 둔 상품의 상세, Layout이 받아 채움). 아직 못 받았거나 숨김 상품이면 null
export function getPinnedProduct(state) {
  const { pickSlot, pickBase, pickProduct } = state
  if (pickSlot === null || !pickBase || pickProduct?.productId !== pickBase.productId) return null
  return pickProduct.productStatus === 'HIDDEN' ? null : pickProduct
}

// 같은 기준의 상품 목록 (서버에 cmp로 보내는 번호): 고르러 나온 중 남은 상품 하나, 없으면 빈 목록
const NO_ITEMS = []
export function useCompareItems() {
  const pickBase = useCompareStore((state) => state.pickBase)
  return useMemo(() => (pickBase ? [pickBase] : NO_ITEMS), [pickBase])
}

// 상품의 자금 용도 목록 (고르는 중 남은 상품은 purposes, 상품 요약/상세는 tags의 PURPOSE)
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

// 상품이 지원하는 상환 방식 코드 목록 (고르는 중 남은 상품은 methods, 상품 요약/상세는 상환 방식 태그. 방식 정보가 없으면 세 방식 모두)
export function getMethods(product) {
  if (!product) return []
  if (Array.isArray(product.methods)) return product.methods
  return getSupportedMethods(product)
}

// 상환 방식이 하나라도 겹치는지 (방식 정보가 없는 상품은 어느 방식이든 가능으로 봐서 막지 않음)
export function hasSameMethod(productA, productB) {
  const methodsB = getMethods(productB)
  return getMethods(productA).some((method) => methodsB.includes(method))
}

// 두 상품을 비교할 수 없는 이유: null 비교 가능 / 'purpose' 자금 용도가 안 겹침 / 'method' 상환 방식이 안 겹침 (둘 다 막히면 용도 먼저)
export function getCompareBlock(productA, productB) {
  if (!hasSamePurpose(productA, productB)) return 'purpose'
  if (!hasSameMethod(productA, productB)) return 'method'
  return null
}

// 상품이 지원하는 상환 방식 이름 목록 (예: ['원리금균등', '원금균등']). 남은 상품, 상품 요약/상세 모두.
// 세 방식 모두이면(방식 정보가 없는 상품) 거르는 조건이 안 되므로 빈 목록
export function getMethodLabels(product) {
  const methods = getMethods(product)
  const labels = REPAY_METHODS.filter((method) => methods.includes(method.code)).map((method) => method.label)
  return labels.length < REPAY_METHODS.length ? labels : []
}

// 그 상품과 비교하려면 겹쳐야 하는 조건 글 (남은 상품, 상품 요약/상세 모두). 뒤에 '이 겹치는 상품…'을 붙여 쓴다.
// 예: '자금 용도(생활비)와 상환 방식(만기일시)' / 세 방식 모두이면(방식 정보가 없는 상품) 방식 이름은 생략: '자금 용도(생활비)와 상환 방식'
export function getCompareConditionText(product) {
  const methodLabels = getMethodLabels(product)
  const methodText = methodLabels.length > 0 ? `상환 방식(${methodLabels.join('·')})` : '상환 방식'
  return `자금 용도(${getPurposes(product).join('·')})와 ${methodText}`
}

// ProductSummaryDTO (또는 상세)에서 비교 검사에 쓰는 값만 뽑음
function toCompareItem(product) {
  return {
    productId: product.productId,
    companyName: product.companyName,
    productName: product.productName,
    purposes: getPurposes(product),
    methods: getMethods(product),
  }
}

const useCompareStore = create(
  persist(
    (set, get) => ({
      pair: [null, null],
      // 비교 화면의 빈 칸을 채우러 나온 중이면 그 칸 ('A', 'B', 없으면 null). 이때 [+ 비교]는 새로 시작하지 않고 그 빈 칸에 넣음 (startCompare)
      pickSlot: null,
      // 그때 비교 화면에 남아 있던 상품 (용도, 상환 방식이 겹치는지 검사하는 기준. 숨김 상품이라 모르면 null)
      pickBase: null,
      // 고르는 중에 남겨 둔 상품의 상세 (검색 결과 맨 위 고정용, 메모리만)
      pickProduct: null,
      setPickProduct: (product) => set({ pickProduct: product }),
      // E15 비교 가능 검사 (자금 용도와 상환 방식이 겹쳐야 함). other가 없으면 늘 true
      canCompare: (product, other) => !other || getCompareBlock(product, other) === null,

      userAmount: null,
      setUserAmount: (value) => set({ userAmount: typeof value === 'number' ? value : null }),

      savedKey: null,
      markSaved: (savedKey) => set({ savedKey }),

      // 두 칸을 다 비우면(비교를 벗어남, 로그아웃, 탈퇴) 직접 바꾼 금액, 저장 표시도 비움
      setPair: (idA, idB) =>
        set(idA === null && idB === null ? { pair: [idA, idB], userAmount: null, savedKey: null } : { pair: [idA, idB] }),

      // 상품 찾기, 맞춤 추천, 찜한 대출의 [+ 비교]: 비교 화면 상품(pair)에 넣음. 이동은 부르는 쪽이 함 (navigate('/compare'))
      // 비교 화면에서 한 칸을 고르러 나온 길(pickSlot)이면: 남은 상품은 그대로 두고 그 칸에 넣음 (그 칸에 있던 상품은 바뀜)
      //   남은 상품과 자금 용도나 상환 방식이 안 겹치면 못 넣고 알림 (E15)
      //   바꾸려던 칸에 이미 있는 상품을 누르면 아무것도 안 바꾸고 돌아감
      //   남겨 둔 상품('A 담음')을 누르면 고르기를 끄고 비교 화면 상품도 비움 (이 화면에 그대로)
      // 고르는 중이 아니면 이 상품 하나만 A에 담아 새로 시작 (비교 화면을 벗어난 상품은 남아 있지 않음)
      // 비교 화면으로 이동해도 되면 true, 이 화면에 그대로 있어야 하면(알림만 띄움, 고르기를 끔) false
      startCompare: (product) => {
        const { pair, pickSlot, pickBase } = get()
        if (pickSlot !== null) {
          // 남겨 둔 상품('A 담음' 표시)을 다시 누르면 담기를 취소한 것: 이 화면에 그대로 있고 비교 화면 상품, 띠, 거르기, 표시가 사라짐
          if (pickBase?.productId === product.productId) {
            set({ pair: [null, null], userAmount: null, savedKey: null, pickSlot: null, pickBase: null })
            return false
          }
          if (pair.includes(product.productId)) {
            set({ pickSlot: null, pickBase: null })
            return true
          }
          const block = pickBase ? getCompareBlock(pickBase, product) : null
          if (block !== null) {
            useUiStore.getState().showToast(block === 'method' ? SAME_METHOD_MESSAGE : SAME_PURPOSE_MESSAGE)
            return false
          }
          const next = [...pair]
          next[pickSlot === 'A' ? 0 : 1] = product.productId
          // B만 담기는 일이 없게: 둘 다 빈 화면에서 B 칸으로 골라도 A에 담음
          set({ pair: next[0] === null ? [next[1], null] : next, pickSlot: null, pickBase: null })
          return true
        }
        set({ pair: [product.productId, null], pickBase: null })
        return true
      },

      // 한 칸 고르러 나감(slot과 남은 상품) / slot을 안 주면 끝
      setPickSlot: (slot, keepProduct = null) =>
        set({ pickSlot: slot, pickBase: slot !== null && keepProduct ? toCompareItem(keepProduct) : null }),

      // 빈 칸 먼저, 둘 다 차 있으면 B를 바꿈
      putPair: (id) => {
        const [idA, idB] = get().pair
        if (idA === null) set({ pair: [id, idB] })
        else if (idB === null) set({ pair: [idA, id] })
        else set({ pair: [idA, id] })
      },

      // 칸 비우기. A를 빼면 B에 있던 상품이 A로 올라옴 (빈 칸은 늘 B)
      clearSlot: (slot) => {
        const [idA, idB] = get().pair
        set({ pair: [slot === 'A' ? idB : idA, null] })
      },

    }),
    {
      name: 'chorong-compare',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        pair: state.pair,
        pickSlot: state.pickSlot,
        pickBase: state.pickBase,
        userAmount: state.userAmount,
        savedKey: state.savedKey,
      }),
    },
  ),
)

// 담은 상품이 있는 대출 비교 중인 화면: 비교 화면, 또는 비교할 상품을 고르러 나온 상품 찾기
// 여기서 벗어나려 하면 먼저 확인 창을 띄움 (Layout, 로그아웃)
export function isComparing(pathname) {
  const { pair, pickSlot } = useCompareStore.getState()
  const isOnCompare = pathname === '/compare' || (pickSlot !== null && getComparePage(pathname) === 'search')
  return isOnCompare && pair.some((id) => id !== null)
}

export default useCompareStore
