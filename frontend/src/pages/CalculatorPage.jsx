import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import CalcHistoryList from '../components/calculator/CalcHistoryList'
import PageHeader from '../components/common/PageHeader'
import RouteTabs from '../components/common/RouteTabs'
import useUiStore from '../store/useUiStore'
import { getInitialCalc } from '../utils/loanMath'

// CA-01 계산기 화면 (SCR-06~08, 23, 25 / /calc, /calc/*): 제목 + 탭 5개 + 탭 내용(Outlet)
// 다른 화면(추천 카드, 상세 창, 비교 카드, 상환능력 기반 계산기)이 navigate state로 넘긴 값
//   (loanAmount 원, loanMonths 개월, interestRate 연 %, repayMethod)은 대출 이자 계산기 처음 값으로 쓴다.
//   범위 밖이거나 이상한 값은 getInitialCalc가 무시하고 기본값을 씀
// 값을 넘기며 다시 들어오면 (location.key가 바뀜) 입력 칸이 새 값으로 시작하도록 탭 내용을 새로 그림. 값 없이 탭만 옮길 때는 그대로
// 계산 기록 (CA-07): 지금 탭 계산기의 저장 기록을 Layout 오른쪽 칸(#page-side, 1180 미만은 본문 아래)에 띄움. 저장한 기록이 있을 때만 보임 (2026-11-26 사용자 결정)
//   [불러오기] → 그 기록 한 줄을 navigate state로 넘겨 같은 주소로 다시 들어옴 (위의 '값을 넘기며 다시 들어오면'과 같음) + 맨 위로 + 알림 '기록을 불러왔어요'
//   계산기가 [결과 저장]에 성공하면 Outlet context의 onSaved()를 불러 목록을 다시 받음
// kind: CalcHistoryList가 받는 계산기 종류
const TABS = [
  { label: '대출 이자', to: '/calc', end: true, kind: 'LOAN' },
  { label: '대출 갈아타기', to: '/calc/change', kind: 'CHANGE' },
  { label: 'DSR', to: '/calc/dsr', kind: 'DSR' },
  { label: '집 살 때 대출한도', to: '/calc/home', kind: 'HOME' },
  { label: '상환능력 기반 대출', to: '/calc/reverse', kind: 'REVERSE' },
]

// 탭 내용 칸: 계산기 배치(CalcLayout, CalcPanel)가 화면 폭 대신 이 칸의 폭을 보고 크기를 정함 (오른쪽 계산 기록 칸이 생기면 좁아짐)
const CalcArea = styled.div`
  container-type: inline-size;
  container-name: calcarea;
`

// Layout 오른쪽 칸 찾기 (바뀌지 않는 DOM 값이라 구독할 것은 없음, 대출 비교 화면과 같은 방법)
const subscribeNothing = () => () => {}
const getSideEl = () => document.getElementById('page-side')

function CalculatorPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const showToast = useUiStore((state) => state.showToast)
  const initial = getInitialCalc(location.state)
  const [savedCount, setSavedCount] = useState(0)
  // Layout 오른쪽 칸(#page-side). 화면에 붙은 뒤에 DOM에서 찾음
  const sideEl = useSyncExternalStore(subscribeNothing, getSideEl, () => null)
  const tab = TABS.find((one) => one.to === location.pathname.replace(/\/$/, '')) ?? TABS[0]

  const handleSaved = () => setSavedCount((count) => count + 1)

  const handleLoad = (item) => {
    navigate(tab.to, { state: item, replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    showToast('기록을 불러왔어요')
  }

  return (
    <>
      <PageHeader crumbs={['계산기']} title="계산기" description="대출 이자부터 갈아타기, DSR까지 직접 계산해 봐요." />
      <RouteTabs tabs={TABS} label="계산기 종류" />
      <CalcArea>
        <Outlet key={location.state ? location.key : 'tab'} context={{ initial, onSaved: handleSaved }} />
      </CalcArea>
      {sideEl &&
        createPortal(
          <CalcHistoryList key={tab.kind} kind={tab.kind} isOnlyWithItems onLoad={handleLoad} refreshKey={savedCount} />,
          sideEl,
        )}
    </>
  )
}

export default CalculatorPage
