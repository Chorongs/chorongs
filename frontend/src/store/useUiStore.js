import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ST-05 화면 열림 상태 (메모리에 둠, helperClosed만 persist + localStorage)
// 지금은 UI-21 Toast(toast, showToast), LY-06, 14, 15(helperOpen, menuOpen), CM-07(sheetProductId, sheetFrom),
// LY-03, 05(recommendOpen, recommendSkipGate, openRecommend, closeRecommend)가 쓰는 값만 있음.
// loginDialogOpen, loginDialogText, openLoginDialog는 CM-17 작업에서 추가한다.

let toastSeq = 0

const useUiStore = create(
  persist(
    (set) => ({
      // 상시 도우미 열림 (LY-06)
      helperOpen: false,
      toggleHelper: () => set((state) => ({ helperOpen: !state.helperOpen })),

      // 1180px 이상에서 도우미를 닫아 둔 상태 (다른 화면, 다음 방문에도 유지하려고 localStorage에 저장)
      // TODO(LY-09, CHORONG-63): HelperPanel이 1180px 이상에서 닫을 때 true, 다시 열 때 false로 바꾸는 쪽을 연결한다. (명세서에 바꾸는 함수 이름이 없음)
      helperClosed: false,

      // 모바일 전체 메뉴 열림 (LY-14, 15)
      menuOpen: false,
      openMenu: () => set({ menuOpen: true }),
      closeMenu: () => set({ menuOpen: false }),

      // 상품 상세 창 (CM-07): 열린 상품 번호 / 어디서 열었는지 (추천에서 열면 'recommend', 랭킹에서 열면 'ranking', 아니면 null)
      sheetProductId: null,
      sheetFrom: null,
      openProduct: (id, from = null) => set({ sheetProductId: id, sheetFrom: from }),
      closeProduct: () => set({ sheetProductId: null, sheetFrom: null }),

      // 맞춤 추천 창 (LY-03, 05): skipGate가 true면 '잠깐' 창을 건너뛰고 1단계부터
      recommendOpen: false,
      recommendSkipGate: false,
      openRecommend: (skipGate = false) => set({ recommendOpen: true, recommendSkipGate: skipGate }),
      closeRecommend: () => set({ recommendOpen: false, recommendSkipGate: false }),

      // 알림: { id, message } / 같은 글이 다시 와도 id가 달라 시간을 다시 셈
      toast: null,
      showToast: (message) => {
        toastSeq += 1
        set({ toast: { id: toastSeq, message } })
      },
    }),
    {
      name: 'chorong-ui',
      partialize: (state) => ({ helperClosed: state.helperClosed }),
    },
  ),
)

export default useUiStore
