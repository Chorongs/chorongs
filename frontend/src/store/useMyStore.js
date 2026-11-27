import { create } from 'zustand'
import * as myApi from '../api/myApi'
import { isGoneError } from '../utils/removeText'

// ST-02 찜 목록: 찜한 상품 번호만 (메모리, 새로고침하면 서버에서 다시 받음)
// 회원만 씀. 로그인할 때 불러오고(useAuthStore.fetchMe), 로그아웃 때는 새로고침으로 비워진다.
export const LIKE_MAX = 30

const useMyStore = create((set, get) => ({
  likedIds: [],

  // API-20 GET: 찜은 최대 30개라 size=30 한 번에 모두 받음. 실패하면 빈 목록 그대로
  // 찜 목록 응답은 공통 PageInfo { list, total, page, size }
  loadLikes: async () => {
    try {
      const data = await myApi.getLikes({ page: 1, size: LIKE_MAX })
      set({ likedIds: (data?.list ?? []).map((item) => item.product.productId) })
    } catch {
      set({ likedIds: [] })
    }
  },

  // API-20 POST/DELETE: 찜 상태를 뒤집고, 바뀐 뒤 찜 상태(true/false)를 돌려줌
  // 실패하면 likedIds를 바꾸지 않고 오류를 그대로 던짐 (409 ALREADY_LIKED는 찜 상태로 표시)
  // 취소 404(다른 탭, 다른 단말기에서 이미 취소함)는 찜 아님으로 맞춘 뒤 오류를 던짐 (부르는 쪽이 '이미 취소한 찜이에요')
  toggleLike: async (id) => {
    if (get().likedIds.includes(id)) {
      try {
        await myApi.deleteLike(id)
      } catch (error) {
        if (isGoneError(error)) set((state) => ({ likedIds: state.likedIds.filter((likedId) => likedId !== id) }))
        throw error
      }
      set((state) => ({ likedIds: state.likedIds.filter((likedId) => likedId !== id) }))
      return false
    }
    try {
      await myApi.postLike(id)
    } catch (error) {
      if (error.response?.data?.code !== 'ALREADY_LIKED') throw error
    }
    set((state) => ({ likedIds: [...state.likedIds, id] }))
    return true
  },
}))

export default useMyStore
