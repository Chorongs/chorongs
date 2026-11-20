import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import useAuthStore from './store/useAuthStore'
import GlobalStyle from './styles/GlobalStyle'
import App from './App.jsx'

// 앱 시작 때 로그인 여부를 1회 확인 (API-17, 실패해도 비회원으로 표시 E3, 네트워크 오류면 1번 더)
useAuthStore.getState().fetchMe()

// 뒤로 가기로 화면이 되살아나면(브라우저 뒤로 가기 캐시, event.persisted) 앱이 다시 시작되지 않아 예전 로그인 상태가 남음 → 다시 확인
// (로그인한 뒤 뒤로 가기로 로그인 화면에 와서 다시 로그인하거나 다른 계정으로 가입하는 것을 막음. 2026-11-17 버그 수정)
window.addEventListener('pageshow', (event) => {
  if (event.persisted) useAuthStore.getState().fetchMe()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalStyle />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
