import { create } from 'zustand'

// ST-05 화면 열림 상태 (메모리에만 둠)
// 지금은 UI-21 Toast(toast, showToast)와 LY-06, 14, 15(helperOpen, menuOpen)가 쓰는 값만 있음.
// sheetProductId, loginDialogOpen 등 나머지 값과 함수는 CM 작업에서 추가한다.

let toastSeq = 0

const useUiStore = create((set) => ({
  // 상시 도우미 열림 (LY-06)
  helperOpen: false,
  toggleHelper: () => set((state) => ({ helperOpen: !state.helperOpen })),

  // 모바일 전체 메뉴 열림 (LY-14, 15)
  menuOpen: false,
  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),

  // 알림: { id, message } / 같은 글이 다시 와도 id가 달라 시간을 다시 셈
  toast: null,
  showToast: (message) => {
    toastSeq += 1
    set({ toast: { id: toastSeq, message } })
  },
}))

export default useUiStore
