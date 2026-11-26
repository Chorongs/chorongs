import * as adminApi from '../api/adminApi'
import * as authApi from '../api/authApi'
import useAdminStore, { ADMIN_LOGGED_IN_TEXT } from '../store/useAdminStore'
import useAuthStore from '../store/useAuthStore'
import useUiStore from '../store/useUiStore'

// CM-22 회원 전용 확인: 회원이면 action 실행, 아니면 로그인 안내 창을 상황 글(CM-17 문구)과 함께 엶
// 화면 숨김용. 권한 확인은 서버가 함 (401이 오면 같은 안내 창, E4)
// 로그인 화면(/login)에서는 로그인 버튼이 이미 보이므로 창을 한 번 더 띄우지 않고 '로그인해 주세요' 알림만
// 가입 단계 화면(/oauth/callback)에서는 창에서 로그인을 누르면 가입을 하다 말고 나가게 되므로 '가입을 마치면 이용할 수 있어요' 알림만
const NOTICE_INSTEAD_OF_DIALOG = {
  '/login': '로그인해 주세요',
  '/oauth/callback': '가입을 마치면 이용할 수 있어요',
}

// 관리자로 로그인 중이면 로그인 안내 창을 띄우지 않고 알림만 (SCR-16 비고: 회원 로그인 막음)
function requireLogin(action, text) {
  if (useAuthStore.getState().status === 'member') {
    action()
    return
  }
  if (useAdminStore.getState().status === 'authed') {
    useUiStore.getState().showToast(ADMIN_LOGGED_IN_TEXT)
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

// 여러 화면이 같이 쓰는 로그인 안내 글 (찜 버튼 CM-06, 찜 바로가기 LY-07, 로그인 안내 창 CM-17, 로그인 화면 AU-01, 로그인 처리 AU-02, 가입 단계 AU-03)
export const LIKE_LOGIN_TEXT = '찜하기는 회원 전용이에요.'
export const ALREADY_LOGGED_IN_TEXT = '이미 로그인되어 있어요'
export const LOGIN_OFFLINE_TEXT = '로그인하지 못했어요. 다시 시도해 주세요'
// 회원 로그인을 시작하려는데 관리자 세션이 있을 때 (화면 글은 두 줄, 알림에서는 한 줄로 보임)
export const ADMIN_SESSION_TEXT = '관리자로 로그인 중이에요.\n관리자에서 로그아웃한 뒤 로그인해 주세요'

// 소셜 로그인으로 보내기 전 확인 (로그인 화면 AU-01, 로그인 안내 창 CM-17이 같이 씀)
// 서버(API-17)에 한 번 더 물어 이미 로그인 중이면 보내지 않음 (다시 로그인, 다른 계정 가입 막음) → 로그인 상태를 다시 채움
// 서버 응답이 아예 없으면(서버 꺼짐, 네트워크 오류) 소셜 로그인으로 보내도 오류 화면만 뜨므로 보내지 않음 (E3)
// 관리자 세션(API-30)이 있으면 보내지 않음 (서버도 막지만 소셜 화면까지 갔다 오지 않게)
// 돌려주는 값: 'offline' 서버 응답 없음 / 'member' 이미 로그인 중 / 'admin' 관리자로 로그인 중 / 'ok' 보내도 됨
export async function checkSocialLogin() {
  try {
    const me = await authApi.getMe()
    if (me?.memberNickname) {
      useAuthStore.getState().fetchMe()
      return 'member'
    }
  } catch (error) {
    // 401 등 서버 응답이 있으면 비회원 → 아래 관리자 확인으로
    if (!error.response) return 'offline'
  }
  const admin = await adminApi.getAdminSession().catch(() => null)
  return admin ? 'admin' : 'ok'
}

// 상품 상세 창(CM-07)에서 소셜 로그인을 다녀오면 그 상세를 다시 열기 위해 잠깐 두는 sessionStorage 이름
// 소셜 로그인은 사이트 밖에 나갔다 오는 이동이라 메모리의 sheetProductId가 지워지기 때문. 상품 번호, 연 곳, 화면 주소만 둠 (E14)
const REOPEN_PRODUCT_KEY = 'chorong-reopen-product'

// 소셜 로그인으로 보내기 바로 전 (로그인 안내 창 CM-17): 상세 창이 열려 있으면 적고, 닫혀 있으면 지움
// pathname: 돌아올 화면 주소 (? 뒤는 화면이 열리면서 바꿀 수 있어 빼고 적음)
export function rememberOpenProduct(pathname) {
  const { sheetProductId, sheetFrom } = useUiStore.getState()
  if (sheetProductId === null) sessionStorage.removeItem(REOPEN_PRODUCT_KEY)
  else sessionStorage.setItem(REOPEN_PRODUCT_KEY, JSON.stringify({ id: sheetProductId, from: sheetFrom, pathname }))
}

// 화면 이동 뒤 (Layout이 상세 창을 닫은 다음): 지금 화면 주소가 적어 둔 화면 주소와 같으면 그 상세를 한 번 다시 엶
// 로그인 처리 화면(/oauth/callback)에서는 돌아올 주소로 옮겨 갈 때까지 기다림. 그 밖의 화면에 오면 열든 안 열든 지움 (한 번만)
export function reopenRememberedProduct() {
  const { pathname } = window.location
  if (pathname === '/oauth/callback') return
  const text = sessionStorage.getItem(REOPEN_PRODUCT_KEY)
  if (text === null) return
  sessionStorage.removeItem(REOPEN_PRODUCT_KEY)
  try {
    const saved = JSON.parse(text)
    if (saved.pathname === pathname) useUiStore.getState().openProduct(saved.id, saved.from)
  } catch {
    // 글이 깨졌으면 다시 열지 않음
  }
}
