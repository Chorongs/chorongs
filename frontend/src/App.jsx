import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import NotFoundPage from './pages/NotFoundPage'

// LY-01 주소 규칙표: Routes > Route element={<Layout />} > 하위 Route (주소 목록은 '화면 목록')
// TODO: 아래 페이지들은 각 이슈에서 올라온 뒤 이 자리에 Route로 추가한다.
//   / HomePage(45), /search SearchPage(64), /search/simple SearchPage(64), /compare ComparePage(47), /ranking RankingPage(60),
//   /calc, /calc/* CalculatorPage(49, 56), /diagnosis/credit, /diagnosis/habit DiagnosisPage(51, 59), /help/* HelpPage(63),
//   /login LoginPage(43), /oauth/callback OAuthCallbackPage(43), /my, /my/:section MyPage(43)
// TODO(CHORONG-55): /admin/login, /admin/join은 그대로, 나머지 /admin/* 은 RequireAdmin으로 감싸 AdminPage에 연결 (화면 숨김용, 권한 확인은 서버)
function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/help" element={<Navigate to="/help/faq" replace />} />
        <Route path="/diagnosis" element={<Navigate to="/diagnosis/credit" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
