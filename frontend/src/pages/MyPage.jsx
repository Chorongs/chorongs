import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
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
import { Button, EmptyBox } from '../styles/common'

// MY-01 MY 화면 (/my, /my/:section, 회원 전용): 왼쪽 메뉴 9개 / 오른쪽 고른 항목 하나 (useParams)
// checking 동안은 로딩만 (로그인 안내가 번쩍 보이지 않게) / 비회원 → 로그인 안내만, 항목 숨김 / 없는 section → /my
// 900px 미만: /my는 항목 목록 화면(한눈에 보기 + 메뉴), 항목을 누르면 그 내용만, 뒤로가기로 목록
//   (모바일에서 로그아웃 버튼이 있는 한눈에 보기도 같이 보이게 목록 위에 둠)
// TODO(MY-01, CHORONG-43 Tong B): 모바일(900px 미만) 배치는 웹이 주력이라 일단 이대로 두고, 사용자 화면 테스트(크기 줄여 확인) 때 다시 정함
const SECTIONS = [
  { key: null, label: '한눈에 보기', component: MyOverview },
  { key: 'liked', label: '찜한 대출', component: LikedList },
  { key: 'recent', label: '최근 본 대출', component: RecentList },
  { key: 'searches', label: '최근 검색', component: SearchHistoryList },
  { key: 'compares', label: '비교 내역', component: CompareHistoryList },
  { key: 'recommendations', label: '저장한 추천 결과', component: SavedRecList },
  { key: 'report', label: '내 진단 리포트', component: DiagnosisReport },
  { key: 'calcs', label: '계산 기록', component: CalcRecords },
  { key: 'profile', label: '회원 정보', component: MemberInfo },
]

const Title = styled.h1`
  margin-bottom: 28px;
  font-size: var(--fs-h1);
  font-weight: 800;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 48px;
  align-items: start;
  @media (max-width: 899px) {
    display: flex;
    flex-direction: column-reverse;
    gap: 28px;
  }
`

const Menu = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 4px;
  @media (max-width: 899px) {
    display: ${({ $isHiddenOnMobile }) => ($isHiddenOnMobile ? 'none' : 'flex')};
  }
`

const MenuLink = styled(NavLink)`
  padding: 10px 14px;
  border-radius: var(--r-sm);
  color: var(--ink-2);
  font-weight: 600;
  transition: background var(--t-fast);
  &:hover {
    background: var(--mist);
  }
  &.active {
    background: var(--brand-soft);
    color: var(--brand-text);
    font-weight: 700;
  }
  @media (max-width: 899px) {
    padding: 14px 4px;
    border-bottom: 1px solid var(--line);
    border-radius: 0;
    &.active {
      background: transparent;
    }
  }
`

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

  if (status !== 'member') {
    return (
      <>
        <Title>MY</Title>
        <EmptyBox>
          로그인하면 찜과 기록을 MY에서 볼 수 있어요
          {/* 로그인 뒤 보던 /my 주소로 돌아오게 지금 주소를 로그인 화면에 넘김 (기획서 3-7, 7-1 9번) */}
          <Button
            $size="sm"
            onClick={() =>
              useAdminStore.getState().status === 'authed' // 관리자로 로그인 중이면 /login으로 보내지 않고 알림 (SCR-16 비고)
                ? useUiStore.getState().showToast(ADMIN_LOGGED_IN_TEXT)
                : navigate('/login', { state: { returnPath: section ? `/my/${section}` : '/my' } })
            }
          >
            로그인
          </Button>
        </EmptyBox>
      </>
    )
  }

  const current = SECTIONS.find((item) => item.key === (section ?? null))
  if (!current) return <Navigate to="/my" replace />
  const Content = current.component

  return (
    <>
      <Title>MY</Title>
      <Grid>
        <Menu aria-label="MY 메뉴" $isHiddenOnMobile={Boolean(section)}>
          {SECTIONS.map((item) => (
            <MenuLink key={item.label} to={item.key ? `/my/${item.key}` : '/my'} end={item.key === null}>
              {item.label}
            </MenuLink>
          ))}
        </Menu>
        <div>
          <Content />
        </div>
      </Grid>
    </>
  )
}

export default MyPage
