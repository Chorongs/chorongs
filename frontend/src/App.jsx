import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import NotFoundPage from './pages/NotFoundPage'
import HomePage from './pages/HomePage'
import RecommendPage from './pages/RecommendPage'

// LY-01 주소 규칙표: Routes > Route element={<Layout />} > 하위 Route (주소 목록은 '화면 목록')
// TODO(LY-01, CHORONG-47/49/51/56/59/60/63/64/43): 아래 페이지들은 각 이슈에서 올라온 뒤 이 자리에 Route로 추가한다.
//   /search SearchPage(CHORONG-64), /search/simple SearchPage(CHORONG-64), /compare ComparePage(CHORONG-47),
//   /ranking RankingPage(CHORONG-60), /calc, /calc/* CalculatorPage(CHORONG-49, 56),
//   /diagnosis/credit DiagnosisPage(CHORONG-51), /diagnosis/habit DiagnosisPage(CHORONG-59), /help/* HelpPage(CHORONG-63),
//   /login LoginPage, /oauth/callback OAuthCallbackPage, /my, /my/:section MyPage (모두 CHORONG-43)
// TODO(LY-01, CHORONG-55): /admin/login, /admin/join은 그대로, 나머지 /admin/* 은 RequireAdmin으로 감싸 AdminPage에 연결 (화면 숨김용, 권한 확인은 서버)
function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/recommend" element={<RecommendPage />} />
        <Route path="/help" element={<Navigate to="/help/faq" replace />} />
        <Route path="/diagnosis" element={<Navigate to="/diagnosis/credit" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
