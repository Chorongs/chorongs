import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import { MY_MENU_GROUPS, getMyMenuPath } from '../constants/menu'
import useAdminStore, { ADMIN_LOGGED_IN_TEXT } from '../store/useAdminStore'
import useAuthStore from '../store/useAuthStore'
import useUiStore from '../store/useUiStore'
import { StatusText } from '../styles/common'

// MY-01 MY 화면 (/my, /my/:section, 회원 전용): 왼쪽 메뉴 9개 / 오른쪽 고른 항목 하나 (useParams)
// checking 동안은 로딩만 (로그인 안내가 번쩍 보이지 않게) / 비회원 → 로그인 안내만, 항목 숨김 / 없는 section → /my
// 메뉴 틀은 관리자 화면과 같은 SideNavLayout (900px 미만은 위에 가로 알약 메뉴, 아래 고른 항목)
// 메뉴 목록은 계정 메뉴(LY-08)와 같이 쓰는 MY_MENU_GROUPS: 한눈에 보기 (맨 위 따로) / 내 기록 (기록 7개, 계산 기록 아래 계산기 5개) / 계정 (회원 정보)
// 메뉴 key → 오른쪽에 그릴 구역 (한눈에 보기는 key가 null, 주소 /my)
const SECTIONS = [
  { key: null, component: MyOverview },
  { key: 'liked', component: LikedList },
  { key: 'recent', component: RecentList },
  { key: 'searches', component: SearchHistoryList },
  { key: 'compares', component: CompareHistoryList },
  { key: 'recommendations', component: SavedRecList },
  { key: 'report', component: DiagnosisReport },
  { key: 'calcs', component: CalcRecords },
  { key: 'profile', component: MemberInfo },
]

// 왼쪽 메뉴 (SideNavLayout groups). 하위 메뉴(계산 기록 아래 계산기 5개, 늘 펼쳐 둠)는 주소 ?kind=로 가고,
// 지금 보는 구역이면 주소의 kind(없거나 틀리면 첫 번째)를 현재 메뉴로 표시 (MY-10이 고르는 기준과 같음)
// '계산 기록' 링크는 /my/calcs (kind 없음 → 대출 이자)
function getNavGroups(section, kindParam) {
  return MY_MENU_GROUPS.map((group) => ({
    title: group.title,
    items: group.items.map((item) => {
      const link = { to: getMyMenuPath(item.key), label: item.label, end: item.key === null }
      if (!item.children) return link
      const isCurrent = section === item.key
      const currentKind = item.children.some((child) => child.key === kindParam) ? kindParam : item.children[0].key
      return {
        ...link,
        children: item.children.map((child) => ({
          to: `${link.to}?kind=${child.key}`,
          label: child.label,
          isActive: isCurrent && child.key === currentKind,
        })),
      }
    }),
  }))
}

const PAGE_DESC = '찜한 대출과 최근 기록, 진단 결과를 한곳에 모았어요.'

function MyPage() {
  const status = useAuthStore((state) => state.status)
  const { section } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  if (status === 'checking') return <StatusText role="status">확인하는 중이에요</StatusText>

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
      <SideNavLayout label="MY 메뉴" groups={getNavGroups(section, searchParams.get('kind'))}>
        <Content />
      </SideNavLayout>
    </>
  )
}

export default MyPage
