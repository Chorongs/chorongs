import { create } from 'zustand'

// ST-05 화면 열림 상태 (메모리에만 둠)
// 지금은 UI-21 Toast가 쓰는 toast, showToast만 있음.
// helperOpen, sheetProductId 등 나머지 값과 함수는 LY, CM 작업에서 추가한다.

let toastSeq = 0

const useUiStore = create((set) => ({
  // 알림: { id, message } / 같은 글이 다시 와도 id가 달라 시간을 다시 셈
  toast: null,
  showToast: (message) => {
    toastSeq += 1
    set({ toast: { id: toastSeq, message } })
  },
}))

export default useUiStore
