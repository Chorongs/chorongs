import useAuthStore from '../store/useAuthStore'
import useUiStore from '../store/useUiStore'

// CM-22 회원 전용 확인: 회원이면 action 실행, 아니면 로그인 안내 창을 상황 글(CM-17 문구)과 함께 엶
// 화면 숨김용. 권한 확인은 서버가 함 (401이 오면 같은 안내 창, E4)
function requireLogin(action, text) {
  if (useAuthStore.getState().status === 'member') {
    action()
    return
  }
  useUiStore.getState().openLoginDialog(text)
}

export default requireLogin
