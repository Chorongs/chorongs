// 창(상품 상세, 로그인 안내, 맞춤 추천, 모바일 전체 메뉴, 대출 비교 벗어나기 확인)이 열려 있는 동안 뒤 화면 스크롤 잠금
// 화면이 옆으로 밀리지 않음: html은 스크롤바 자리를 늘 비워 두고(GlobalStyle), 잠그는 동안에는 본문(body)을 화면 높이로 자르고
// 보던 위치만큼 본문 안에서 내려 둠 → 화면 스크롤 범위가 없어져 막대만 사라지고(자리는 남음), 보이는 화면과 상단바 위치는 그대로
// 여러 창이 겹쳐 열려도 마지막 창이 닫힐 때 풀림
// 풀 때: 잠근 뒤 주소(화면)가 바뀌었으면 맨 위로 (Layout의 '화면 이동 시 스크롤 맨 위로'와 같게), 아니면 보던 위치로
let lockCount = 0
let savedY = 0
let savedPath = ''

export function lockScroll() {
  lockCount += 1
  if (lockCount > 1) return
  savedY = window.scrollY
  savedPath = window.location.pathname
  const { body } = document
  body.style.height = '100vh'
  body.style.overflow = 'hidden'
  body.scrollTop = savedY
  // 비워 둔 스크롤바 자리도 뒤 화면처럼 흐리게 (GlobalStyle html[data-scroll-locked])
  document.documentElement.setAttribute('data-scroll-locked', '')
}

export function unlockScroll() {
  if (lockCount === 0) return
  lockCount -= 1
  if (lockCount > 0) return
  const { body } = document
  body.style.height = ''
  body.style.overflow = ''
  document.documentElement.removeAttribute('data-scroll-locked')
  window.scrollTo(0, window.location.pathname === savedPath ? savedY : 0)
}
