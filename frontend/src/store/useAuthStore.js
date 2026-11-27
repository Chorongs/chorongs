import { create } from 'zustand'
import * as authApi from '../api/authApi'
import useCompareStore from './useCompareStore'
import useMyStore from './useMyStore'
import { useRecommendStore } from './useRecommendStore'

// ST-01 로그인 정보 (저장 안 함: 로그인은 서버 쿠키 세션, E14)
// user: { memberNickname, loginType, birthYear, birthDay } (비회원 null) / status: checking, guest, member
// 가입 완료(API-50), 회원 정보 수정(API-28)처럼 서버가 MemberResponseDTO를 돌려주면 쓰는 쪽에서 setState({ user })로 바꾼다.

// 로그아웃, 탈퇴 뒤 새로고침하며 메인(/)으로 간 다음 한 번만 보일 알림 글
// 새로고침하면 메모리의 알림이 지워져서 sessionStorage에 글만 잠깐 둠 (개인정보 아님, 꺼내면 바로 지움)
const RELOAD_TOAST_KEY = 'chorong-reload-toast'

// 로그아웃, 탈퇴 때 회원이 남긴 화면 값 비우기: 추천 입력, 결과 (ST-03 '로그아웃, 탈퇴 시 clear()'), 비교 화면 두 상품, 고르는 중 (ST-04),
// 이 탭의 임시 저장값 전부 (sessionStorage)
export function clearMemberData() {
  useRecommendStore.getState().clear()
  useCompareStore.getState().setPickSlot(null)
  useCompareStore.getState().setPair(null, null)
  sessionStorage.clear()
}

// 알림 글을 적고 새로고침하며 메인으로 (메모리의 스토어 값이 한꺼번에 비워짐). sessionStorage를 비운 뒤에 부름
export function reloadToMainWithToast(message) {
  sessionStorage.setItem(RELOAD_TOAST_KEY, message)
  window.location.replace('/')
}

// 화면을 처음 그릴 때 한 번: 적어 둔 알림 글을 꺼내고 지움 (없으면 null)
export function takeReloadToast() {
  const message = sessionStorage.getItem(RELOAD_TOAST_KEY)
  sessionStorage.removeItem(RELOAD_TOAST_KEY)
  return message
}

const useAuthStore = create((set) => ({
  user: null,
  status: 'checking',

  // API-17로 로그인 여부 확인. 401이면 guest, 네트워크 오류(응답 없음)면 guest로 보이되 한 번 더 확인
  // 다시 확인(isRetry)할 때는 checking으로 바꾸지 않음 (guest로 보인 채로 확인, 버튼이 다시 숨지 않게)
  fetchMe: async (isRetry = false) => {
    if (!isRetry) set({ status: 'checking' })
    try {
      const user = await authApi.getMe()
      // 성공(200)인데 내 정보가 없으면 비회원으로 (API 주소 설정이 없거나 틀려 화면 서버가 HTML을 돌려준 경우 등, 화면이 멈추지 않게)
      if (!user?.memberNickname) {
        set({ user: null, status: 'guest' })
        return
      }
      set({ user, status: 'member' })
      // 회원이면 찜한 상품 번호를 불러옴 (ST-02)
      useMyStore.getState().loadLikes()
    } catch (error) {
      set({ user: null, status: 'guest' })
      if (!error.response && !isRetry) await useAuthStore.getState().fetchMe(true)
    }
  },

  // API-16 로그아웃 + 이 탭의 임시 저장값(sessionStorage: 추천 입력, 신용 진단 답, 소비 습관 입력, 비교 화면 상품 등) 비우기
  // 서버 로그아웃이 실패해도 화면 쪽 값은 비운다 (E6)
  // 메모리의 스토어 값은 부르는 쪽이 reloadToMainWithToast로 새로고침하며 메인(/)으로 가서 한꺼번에 비운다.
  logout: async () => {
    try {
      await authApi.postLogout()
    } catch {
      // 실패해도 아래에서 비움
    }
    clearMemberData()
  },
}))

export default useAuthStore
