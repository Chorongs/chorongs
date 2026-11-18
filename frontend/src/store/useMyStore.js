import { create } from 'zustand'
import * as myApi from '../api/myApi'

// ST-02 찜 목록: 찜한 상품 번호만 (메모리, 새로고침하면 서버에서 다시 받음)
// 회원만 씀. 로그인할 때 불러오고(useAuthStore.fetchMe), 로그아웃 때는 새로고침으로 비워진다.
const LIKE_MAX = 30

const useMyStore = create((set, get) => ({
  likedIds: [],

  // API-20 GET: 찜은 최대 30개라 size=30 한 번에 모두 받음. 실패하면 빈 목록 그대로
  // 찜 목록 응답은 공통 PageInfo { list, total, page, size } (2026-11-17 백엔드 담당 결정)
  // TODO(API-20, CHORONG-42 BE): 찜 API는 아직 서버에 없음. 올라오면 응답이 위 모양인지 확인
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
  toggleLike: async (id) => {
    if (get().likedIds.includes(id)) {
      await myApi.deleteLike(id)
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
