import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import LoanCalculator from './components/calculator/LoanCalculator'
import CreditCheck from './components/credit/CreditCheck'
import CalculatorPage from './pages/CalculatorPage'
import ComparePage from './pages/ComparePage'
import DiagnosisPage from './pages/DiagnosisPage'
import LoginPage from './pages/LoginPage'
import MyPage from './pages/MyPage'
import NotFoundPage from './pages/NotFoundPage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'
import HomePage from './pages/HomePage'
import RecommendPage from './pages/RecommendPage'

// LY-01 주소 규칙표: Routes > Route element={<Layout />} > 하위 Route (주소 목록은 '화면 목록')
// TODO(LY-01, CHORONG-51 김진석, 56 김진석, 59 조빌립, 60 김채희, 63 김채희, 64 조빌립): 아래 페이지들은 각 이슈에서 올라온 뒤 이 자리에 Route로 추가한다.
//   /search SearchPage(CHORONG-64), /search/simple SearchPage(CHORONG-64),
//   /ranking RankingPage(CHORONG-60), /calc/change, /calc/dsr, /calc/home, /calc/reverse (CalculatorPage 하위, CHORONG-56),
//   /diagnosis/habit DiagnosisPage(CHORONG-59), /help/* HelpPage(CHORONG-63),
//   (/login, /oauth/callback, /my, /my/:section 은 CHORONG-43에서 연결함)
// TODO(LY-01, CHORONG-55 Tong-B): /admin/login, /admin/join은 그대로, 나머지 /admin/* 은 RequireAdmin으로 감싸 AdminPage에 연결 (화면 숨김용, 권한 확인은 서버)
function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/recommend" element={<RecommendPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/calc" element={<CalculatorPage />}>
          <Route index element={<LoanCalculator />} />
          {/* TODO(CHORONG-56): change, dsr, home, reverse 하위 Route는 그 계산기 화면이 올라온 뒤 추가한다. */}
        </Route>
        <Route path="/help" element={<Navigate to="/help/faq" replace />} />
        <Route path="/diagnosis" element={<DiagnosisPage />}>
          <Route index element={<Navigate to="/diagnosis/credit" replace />} />
          <Route path="credit" element={<CreditCheck />} />
          {/* TODO(CHORONG-59): habit 하위 Route는 소비 습관 분석 화면이 올라온 뒤 추가한다. */}
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/my" element={<MyPage />} />
        <Route path="/my/:section" element={<MyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
