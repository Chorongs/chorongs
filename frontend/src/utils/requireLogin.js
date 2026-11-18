import useAuthStore from '../store/useAuthStore'
import useUiStore from '../store/useUiStore'

// CM-22 회원 전용 확인: 회원이면 action 실행, 아니면 로그인 안내 창을 상황 글(CM-17 문구)과 함께 엶
// 화면 숨김용. 권한 확인은 서버가 함 (401이 오면 같은 안내 창, E4)
// 로그인 화면(/login)에서는 로그인 버튼이 이미 보이므로 창을 한 번 더 띄우지 않고 '로그인해 주세요' 알림만 (2026-11-17 사용자 결정)
// 가입 단계 화면(/oauth/callback)에서는 창에서 로그인을 누르면 가입을 하다 말고 나가게 되므로 '가입을 마치면 이용할 수 있어요' 알림만 (같은 날 사용자 결정)
const NOTICE_INSTEAD_OF_DIALOG = {
  '/login': '로그인해 주세요',
  '/oauth/callback': '가입을 마치면 이용할 수 있어요',
}

function requireLogin(action, text) {
  if (useAuthStore.getState().status === 'member') {
    action()
    return
  }
  const notice = NOTICE_INSTEAD_OF_DIALOG[window.location.pathname]
  if (notice) {
    useUiStore.getState().showToast(notice)
    return
  }
  useUiStore.getState().openLoginDialog(text)
}

export default requireLogin
