import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import useAuthStore from './store/useAuthStore'
import GlobalStyle from './styles/GlobalStyle'
import App from './App.jsx'

// 앱 시작 때 로그인 여부를 1회 확인 (API-17, 실패해도 비회원으로 표시 E3, 네트워크 오류면 1번 더)
useAuthStore.getState().fetchMe()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalStyle />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
