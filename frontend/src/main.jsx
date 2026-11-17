import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import GlobalStyle from './styles/GlobalStyle'
import App from './App.jsx'

// TODO(ST-01, CHORONG-43): useAuthStore.fetchMe()가 올라오면 앱 시작 때 로그인 여부를 1회 확인한다. (API-17, 실패해도 비회원으로 표시, E3)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalStyle />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
