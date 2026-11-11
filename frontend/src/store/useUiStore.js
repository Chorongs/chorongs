import { create } from 'zustand'

// ST-05 화면 열림 상태 (메모리에만 둠)
// 지금은 UI-21 Toast(toast, showToast), LY-06, 14, 15(helperOpen, menuOpen), CM-07(sheetProductId, sheetFrom)이 쓰는 값만 있음.
// loginDialogOpen, loginDialogText, openLoginDialog는 CM-17 작업에서 추가한다.

let toastSeq = 0

const useUiStore = create((set) => ({
  // 상시 도우미 열림 (LY-06)
  helperOpen: false,
  toggleHelper: () => set((state) => ({ helperOpen: !state.helperOpen })),

  // 모바일 전체 메뉴 열림 (LY-14, 15)
  menuOpen: false,
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),

  // 상품 상세 창 (CM-07): 열린 상품 번호 / 어디서 열었는지 (추천에서 열면 'recommend', 아니면 null)
  sheetProductId: null,
  sheetFrom: null,
  openProduct: (id, from = null) => set({ sheetProductId: id, sheetFrom: from }),
  closeProduct: () => set({ sheetProductId: null, sheetFrom: null }),

  // 알림: { id, message } / 같은 글이 다시 와도 id가 달라 시간을 다시 셈
  toast: null,
  showToast: (message) => {
    toastSeq += 1
    set({ toast: { id: toastSeq, message } })
  },
}))

export default useUiStore
