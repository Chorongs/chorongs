import { Outlet } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import RouteTabs from '../components/common/RouteTabs'

// CR-01 금융 진단 화면: 제목 + 탭 2개(신용 셀프 진단, 소비 습관 분석) + 탭 내용(Outlet)
// 탭 내용은 App.jsx의 하위 Route가 정한다. (소비 습관 분석 화면은 CHORONG-59에서 연결)
const TABS = [
  { label: '신용 셀프 진단', to: '/diagnosis/credit' },
  { label: '소비 습관 분석', to: '/diagnosis/habit' },
]

function DiagnosisPage() {
  return (
    <>
      <PageHeader
        crumbs={['금융 진단']}
        title="금융 진단"
        description="질문에 답하고 내 신용 상태와 소비 습관을 확인해 보세요."
      />
      <RouteTabs tabs={TABS} label="금융 진단 탭" />
      <Outlet />
    </>
  )
}

export default DiagnosisPage
