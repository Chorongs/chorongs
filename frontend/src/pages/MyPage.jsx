import { Navigate, useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import PageHeader from '../components/common/PageHeader'
import SideNavLayout from '../components/layout/SideNavLayout'
import CalcRecords from '../components/my/CalcRecords'
import CompareHistoryList from '../components/my/CompareHistoryList'
import DiagnosisReport from '../components/my/DiagnosisReport'
import LikedList from '../components/my/LikedList'
import MemberInfo from '../components/my/MemberInfo'
import MyOverview from '../components/my/MyOverview'
import RecentList from '../components/my/RecentList'
import SavedRecList from '../components/my/SavedRecList'
import SearchHistoryList from '../components/my/SearchHistoryList'
import useAdminStore, { ADMIN_LOGGED_IN_TEXT } from '../store/useAdminStore'
import useAuthStore from '../store/useAuthStore'
import useUiStore from '../store/useUiStore'

// MY-01 MY 화면 (/my, /my/:section, 회원 전용): 왼쪽 메뉴 9개 / 오른쪽 고른 항목 하나 (useParams)
// checking 동안은 로딩만 (로그인 안내가 번쩍 보이지 않게) / 비회원 → 로그인 안내만, 항목 숨김 / 없는 section → /my
// 메뉴 틀은 관리자 화면과 같은 SideNavLayout (900px 미만은 위에 가로 알약 메뉴, 아래 고른 항목)
const MENU_GROUPS = [
  {
    title: 'MY',
    items: [
      { key: null, label: '한눈에 보기', component: MyOverview },
      { key: 'liked', label: '찜한 대출', component: LikedList },
      { key: 'recent', label: '최근 본 대출', component: RecentList },
      { key: 'searches', label: '최근 검색', component: SearchHistoryList },
      { key: 'compares', label: '비교 내역', component: CompareHistoryList },
      { key: 'recommendations', label: '저장한 추천 결과', component: SavedRecList },
    ],
  },
  {
    title: '관리',
    items: [
      { key: 'report', label: '내 진단 리포트', component: DiagnosisReport },
      { key: 'calcs', label: '계산 기록', component: CalcRecords },
      { key: 'profile', label: '회원 정보', component: MemberInfo },
    ],
  },
]

const SECTIONS = MENU_GROUPS.flatMap((group) => group.items)

const NAV_GROUPS = MENU_GROUPS.map((group) => ({
  title: group.title,
  items: group.items.map((item) => ({
    to: item.key ? `/my/${item.key}` : '/my',
    label: item.label,
    end: item.key === null,
  })),
}))

const PAGE_DESC = '찜한 대출과 최근 기록, 진단 결과를 한곳에 모았어요.'

const Status = styled.p`
  padding: 36px 0;
  color: var(--cocoa);
  text-align: center;
`

function MyPage() {
  const status = useAuthStore((state) => state.status)
  const { section } = useParams()
  const navigate = useNavigate()

  if (status === 'checking') return <Status role="status">확인하는 중이에요</Status>

  // 비회원 [로그인]: 관리자로 로그인 중이면 /login으로 보내지 않고 알림 (SCR-16 비고)
  //   아니면 로그인 뒤 보던 /my 주소로 돌아오게 지금 주소를 로그인 화면에 넘김 (기획서 3-7, 7-1 9번)
  const handleGuestLogin = () => {
    if (useAdminStore.getState().status === 'authed') {
      useUiStore.getState().showToast(ADMIN_LOGGED_IN_TEXT)
      return
    }
    navigate('/login', { state: { returnPath: section ? `/my/${section}` : '/my' } })
  }

  if (status !== 'member') {
    return (
      <>
        <PageHeader crumbs={['MY']} title="MY" description={PAGE_DESC} />
        <MyOverview onLogin={handleGuestLogin} />
      </>
    )
  }

  const current = SECTIONS.find((item) => item.key === (section ?? null))
  if (!current) return <Navigate to="/my" replace />
  const Content = current.component

  return (
    <>
      <PageHeader crumbs={['MY']} title="MY" description={PAGE_DESC} />
      <SideNavLayout label="MY 메뉴" groups={NAV_GROUPS}>
        <Content />
      </SideNavLayout>
    </>
  )
}

export default MyPage
