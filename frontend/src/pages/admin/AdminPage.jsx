import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import * as adminApi from '../../api/adminApi'
import AdminAccounts from '../../components/admin/AdminAccounts'
import AdminMyAccount from '../../components/admin/AdminMyAccount'
import AutoClosedList from '../../components/admin/AutoClosedList'
import ImportDiff from '../../components/admin/ImportDiff'
import ImportPanel from '../../components/admin/ImportPanel'
import PublishHistory from '../../components/admin/PublishHistory'
import Icon from '../../components/ui/Icon'
import { ADMIN_ROLE_LABEL } from '../../constants/options'
import useAdminStore from '../../store/useAdminStore'
import useUiStore from '../../store/useUiStore'
import { Button, Tag } from '../../styles/common'
import { formatTime } from '../../utils/format'

// AD-03 관리자 화면 (/admin, /admin/:section, SCR-22, RequireAdmin 안): 관리자 배지, 이름, 역할, 끝나는 시각 ('14:32까지'), 로그아웃 / 왼쪽 메뉴 7개 (4묶음) / 고른 항목 하나
// 항목은 MyPage(MY-01)처럼 useParams로 고른다 (Outlet 대신. 현황(API-31) 다시 불러오기 함수를 자식에 props로 넘기기 위해)
// 로그아웃 → API-30 DELETE → /admin/login / 끝나는 시각이 되면 바로 guest로 → RequireAdmin이 /admin/login (서버 401 기다리지 않음)
// 관리자 계정 메뉴는 승인권자에게만 보임 (화면 숨김용, 권한 확인은 서버)
// 메뉴 옆 개수는 현황(API-31 CatalogResponseDTO): autoClosedUncheckedCount, reportedProductCount, pendingAdminCount (관리자는 null → 안 보임)
// TODO(AD-07, CHORONG-52 Tong B / AD-08 2차, CHORONG-55 Tong B): 신고 상품 관리(ReportedList)와 질문 남기기 관리가 올라오면 'reported', 'questions' 항목에 연결. 그 전에는 '아직 준비 중인 메뉴예요'
const MENU_GROUPS = [
  {
    title: '상품 데이터',
    items: [
      { key: null, label: '상품 업데이트' },
      { key: 'auto-closed', label: '자동 내림 확인', countKey: 'autoClosedUncheckedCount', countLabel: '확인 전' },
      { key: 'history', label: '반영 이력' },
    ],
  },
  {
    title: '회원 신고',
    items: [{ key: 'reported', label: '신고 상품 관리', countKey: 'reportedProductCount', countLabel: '미처리 5건 이상 상품' }],
  },
  { title: '고객 문의', items: [{ key: 'questions', label: '질문 남기기 관리' }] },
  {
    title: '계정',
    items: [
      { key: 'admins', label: '관리자 계정', countKey: 'pendingAdminCount', countLabel: '승인 대기', isApproverOnly: true },
      { key: 'me', label: '내 계정' },
    ],
  },
]

const SECTIONS = MENU_GROUPS.flatMap((group) => group.items)

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 20px;
  margin-bottom: 28px;
`

// 관리자 배지: 검은 바탕 작은 딱지
const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  margin-bottom: 12px;
  padding: 0 10px;
  border-radius: var(--r-xs);
  background: var(--ink);
  color: var(--paper);
  font-size: var(--fs-xs);
  font-weight: 800;
`

const Title = styled.h1`
  font-size: var(--fs-h1);
  font-weight: 800;
`

const Desc = styled.p`
  margin-top: 8px;
  color: var(--cocoa);
  font-size: var(--fs-lg);
`

// 누가 로그인했는지: 동그란 아바타 + 이름, 역할 딱지 + 이메일 · 끝나는 시각
const Who = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 6px;
  @media (max-width: 899px) {
    width: 100%;
  }
`

const Avatar = styled.span`
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--paper);
`

const WhoText = styled.div`
  min-width: 0;
  b {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--fs-base);
    font-weight: 800;
    line-height: 1.3;
  }
  small {
    display: block;
    color: var(--cocoa);
    font-size: var(--fs-xs);
    overflow-wrap: anywhere;
  }
  small b {
    display: inline;
    color: var(--ink);
    font-family: var(--f-num);
    font-size: inherit;
    font-weight: 700;
  }
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 40px;
  align-items: start;
  @media (max-width: 899px) {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
`

const Menu = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 20px;
  @media (max-width: 899px) {
    flex-flow: row wrap;
    gap: 6px;
  }
`

const MenuGroup = styled.div`
  @media (max-width: 899px) {
    display: contents;
  }
`

const MenuTitle = styled.h4`
  margin-bottom: 4px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--ink);
  font-size: var(--fs-base);
  font-weight: 800;
  @media (max-width: 899px) {
    display: none;
  }
`

const MenuLink = styled(NavLink)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 2px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 600;
  transition: color var(--t-fast);
  &:hover {
    color: var(--brand-text);
  }
  &.active {
    color: var(--ink);
    font-weight: 800;
  }
  @media (max-width: 899px) {
    padding: 9px 14px;
    border-radius: var(--r-pill);
    background: var(--mist);
    font-size: var(--fs-sm);
    font-weight: 700;
    &.active {
      background: var(--ink);
      color: var(--paper);
    }
  }
`

// 메뉴 옆 개수: 빨간 알약
const Count = styled.span`
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: var(--r-sm);
  background: var(--bad);
  color: #fff;
  font-family: var(--f-num);
  font-size: var(--fs-xs);
  font-weight: 900;
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 48px;
  min-width: 0;
`

// 관리자 목록 안 빈 상태, 안내: 테두리 없는 작은 글씨 (fe_design 빈 상태)
const Status = styled.p`
  padding: 36px 20px;
  border-bottom: 1px solid var(--line);
  color: var(--cocoa);
  font-size: var(--fs-md);
  text-align: center;
`

// 'yyyy-MM-dd HH:mm' → 밀리초 (브라우저마다 공백 구분을 다르게 읽어 T로 바꿔 읽음). 못 읽으면 NaN
function parseExpiresAt(expiresAt) {
  return expiresAt ? Date.parse(String(expiresAt).replace(' ', 'T')) : NaN
}

function AdminPage() {
  const admin = useAdminStore((state) => state.admin)
  const expiresAt = useAdminStore((state) => state.expiresAt)
  const signOut = useAdminStore((state) => state.signOut)
  const showToast = useUiStore((state) => state.showToast)
  const { section } = useParams()
  const navigate = useNavigate()
  // 현황 (API-31): status loading / error / done. attempt가 바뀌면 다시 불러옴
  const [catalog, setCatalog] = useState({ status: 'loading', data: null })
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  // ① [최신 상품 불러오기]로 DB에서 읽은 작업 (API-33 latest, jobStatus DONE) → ②에 넘김. 갱신을 시작하면 비움, 다시 열 때는 안내만 (목록은 버튼으로)
  const [importJob, setImportJob] = useState(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    let isCancelled = false
    adminApi
      .getCatalog()
      .then((data) => {
        if (!isCancelled) setCatalog({ status: 'done', data })
      })
      .catch((error) => {
        if (!isCancelled && error.response?.status !== 401) setCatalog({ status: 'error', data: null })
      })
    return () => {
      isCancelled = true
    }
  }, [catalogAttempt, section])

  const reloadCatalog = useCallback(() => setCatalogAttempt((count) => count + 1), [])

  // 끝나는 시각이 되면 바로 로그아웃 상태로 (1초마다 확인)
  useEffect(() => {
    const expireMs = parseExpiresAt(expiresAt)
    if (Number.isNaN(expireMs)) return undefined
    const timer = setInterval(() => {
      if (Date.now() < expireMs) return
      clearInterval(timer)
      useAdminStore.setState({ admin: null, status: 'guest', expiresAt: null })
      showToast('2시간이 지나 자동으로 로그아웃했어요')
    }, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, showToast])

  const isApprover = admin?.adminRole === 'APPROVER'
  const current = SECTIONS.find((item) => item.key === (section ?? null))
  if (!current) return <Navigate to="/admin" replace />

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  let content
  if (current.key === null) {
    content = (
      <>
        <ImportPanel
          catalog={catalog.data}
          catalogStatus={catalog.status}
          onReloadCatalog={reloadCatalog}
          onDone={setImportJob}
        />
        <ImportDiff key={importJob?.jobId ?? 'none'} job={importJob} onPublished={reloadCatalog} />
      </>
    )
  } else if (current.key === 'auto-closed') {
    content = <AutoClosedList onChanged={reloadCatalog} />
  } else if (current.key === 'history') {
    content = <PublishHistory onChanged={reloadCatalog} />
  } else if (current.key === 'admins') {
    content = isApprover ? <AdminAccounts onChanged={reloadCatalog} /> : <Status>승인권자만 쓸 수 있는 메뉴예요</Status>
  } else if (current.key === 'me') {
    content = <AdminMyAccount />
  } else {
    content = <Status>아직 준비 중인 메뉴예요</Status>
  }

  return (
    <>
      <Head>
        <div>
          <Badge>
            <Icon name="shield" size={13} />
            관리자
          </Badge>
          <Title>캐링 관리자</Title>
          <Desc>상품 데이터와 신고, 관리자 계정을 관리해요.</Desc>
        </div>
        <Who>
          <Avatar aria-hidden="true">
            <Icon name="shield" size={16} />
          </Avatar>
          <WhoText>
            <b>
              {admin?.adminName ?? '-'}
              <Tag $variant={isApprover ? 'acc' : 'default'}>{ADMIN_ROLE_LABEL[admin?.adminRole] ?? admin?.adminRole ?? '-'}</Tag>
            </b>
            <small>
              {admin?.adminEmail ?? '-'} · <b>{formatTime(expiresAt)}까지</b> (2시간 고정)
            </small>
          </WhoText>
          <Button $size="sm" $variant="outline" onClick={handleSignOut} disabled={isSigningOut}>
            로그아웃
          </Button>
        </Who>
      </Head>
      <Grid>
        <Menu aria-label="관리자 메뉴">
          {MENU_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.isApproverOnly || isApprover)
            if (items.length === 0) return null
            return (
              <MenuGroup key={group.title}>
                <MenuTitle>{group.title}</MenuTitle>
                {items.map((item) => {
                  const count = item.countKey ? catalog.data?.[item.countKey] : null
                  return (
                    <MenuLink key={item.label} to={item.key ? `/admin/${item.key}` : '/admin'} end={item.key === null}>
                      {item.label}
                      {count > 0 && <Count aria-label={`${item.countLabel} ${count}`}>{count}</Count>}
                    </MenuLink>
                  )
                })}
              </MenuGroup>
            )
          })}
        </Menu>
        <Content>{content}</Content>
      </Grid>
    </>
  )
}

export default AdminPage
