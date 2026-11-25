import { Outlet, useLocation } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import RouteTabs from '../components/common/RouteTabs'
import { getInitialCalc } from '../utils/loanMath'

// CA-01 계산기 화면 (SCR-06~08, 23, 25 / /calc, /calc/*): 제목 + 탭 5개 + 탭 내용(Outlet)
// 다른 화면(추천 카드, 상세 창, 비교 카드, 상환능력 기반 계산기)이 navigate state로 넘긴 값
//   (loanAmount 원, loanMonths 개월, interestRate 연 %, repayMethod)은 대출 이자 계산기 처음 값으로 쓴다.
//   범위 밖이거나 이상한 값은 getInitialCalc가 무시하고 기본값을 씀
// 값을 넘기며 다시 들어오면 (location.key가 바뀜) 입력 칸이 새 값으로 시작하도록 탭 내용을 새로 그림. 값 없이 탭만 옮길 때는 그대로
const TABS = [
  { label: '대출 이자', to: '/calc', end: true },
  { label: '대출 갈아타기', to: '/calc/change' },
  { label: 'DSR', to: '/calc/dsr' },
  { label: '집 살 때 대출한도', to: '/calc/home' },
  { label: '상환능력 기반 대출', to: '/calc/reverse' },
]

function CalculatorPage() {
  const location = useLocation()
  const initial = getInitialCalc(location.state)

  return (
    <>
      <PageHeader crumbs={['계산기']} title="계산기" description="대출 이자부터 갈아타기, DSR까지 직접 계산해 봐요." />
      <RouteTabs tabs={TABS} label="계산기 종류" />
      <Outlet key={location.state ? location.key : 'tab'} context={{ initial }} />
    </>
  )
}

export default CalculatorPage
