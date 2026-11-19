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

// AD-03 관리자 화면 (/admin, /admin/:section, SCR-22, RequireAdmin 안): 관리자 배지, 이름, 역할, 끝나는 시각 ('14:32까지'), 로그아웃 / 왼쪽 메뉴 7개 / 고른 항목 하나
// 항목은 MyPage(MY-01)처럼 useParams로 고른다 (Outlet 대신. 현황(API-31) 다시 불러오기 함수를 자식에 props로 넘기기 위해)
// 로그아웃 → API-30 DELETE → /admin/login / 끝나는 시각이 되면 바로 guest로 → RequireAdmin이 /admin/login (서버 401 기다리지 않음)
// 관리자 계정 메뉴는 승인권자에게만 보임 (화면 숨김용, 권한 확인은 서버)
// 메뉴 옆 개수는 현황(API-31, CatalogResponseDTO)에서: 자동 내림 확인 전, 미처리 신고 상품 (미처리 5건 이상), 승인 대기 (승인권자만)
// TODO(CHORONG-57 BE): CatalogResponseDTO 필드 이름(autoClosedUncheckedCount, reportedProductCount, pendingAdminCount, currentVersion, sourceCounts)과
//   AdminResponseDTO(adminName, adminRole, expiresAt)는 DTO 파일이 올라오면 맞춘다. expiresAt이 시간대 없는 글(LocalDateTime)이면 브라우저 시간대로 읽는다
// TODO(AD-07, CHORONG-36): 신고 상품 관리는 ReportedList가 올라오면 'reported' 항목에 연결 / TODO(AD-08): 질문 남기기 관리는 QuestionManager(2차)가 올라오면 'questions' 항목에 연결
const SECTIONS = [
  { key: null, label: '상품 업데이트' },
  { key: 'auto-closed', label: '자동 내림 확인', countKey: 'autoClosedUncheckedCount', countLabel: '확인 전' },
  { key: 'history', label: '반영 이력' },
  { key: 'reported', label: '신고 상품 관리', countKey: 'reportedProductCount', countLabel: '미처리 5건 이상 상품' },
  { key: 'questions', label: '질문 남기기 관리' },
  { key: 'admins', label: '관리자 계정', countKey: 'pendingAdminCount', countLabel: '승인 대기', isApproverOnly: true },
  { key: 'me', label: '내 계정' },
]

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 28px;
`

const Title = styled.h1`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: var(--fs-h1);
  font-weight: 800;
`

const Who = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  b {
    color: var(--ink);
    font-weight: 700;
  }
`

const Expire = styled.span`
  color: var(--cocoa);
  font-family: var(--f-num);
  font-variant-numeric: tabular-nums;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 48px;
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
  gap: 4px;
`

const MenuLink = styled(NavLink)`
  display: flex;
  flex-direction: column;
  gap: 4px;
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
`

const Count = styled.small`
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 600;
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 28px;
  min-width: 0;
`

// 관리자 목록 안 빈 상태, 안내: 테두리 없는 작은 글씨 (fe_design 빈 상태)
const Status = styled.p`
  padding: 36px 0;
  color: var(--cocoa);
  font-size: var(--fs-md);
  text-align: center;
`

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
  // ① 불러오기가 끝난 작업 (API-33 결과) → ②에 넘김. 항목을 옮기면 비워진다
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
    const expireMs = expiresAt ? Date.parse(expiresAt) : NaN
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
  const sections = SECTIONS.filter((item) => !item.isApproverOnly || isApprover)
  const current = SECTIONS.find((item) => item.key === (section ?? null))
  if (!current) return <Navigate to="/admin" replace />

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  const countOf = (item) => (item.countKey ? catalog.data?.[item.countKey] : null)

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
        <ImportDiff key={importJob?.importId ?? 'none'} job={importJob} onPublished={reloadCatalog} />
      </>
    )
  } else if (current.key === 'auto-closed') {
    content = <AutoClosedList onChanged={reloadCatalog} />
  } else if (current.key === 'history') {
    content = <PublishHistory baseVersion={catalog.data?.currentVersion ?? null} onChanged={reloadCatalog} />
  } else if (current.key === 'admins') {
    content = isApprover ? <AdminAccounts onChanged={reloadCatalog} /> : <Status>승인권자만 쓸 수 있는 메뉴예요</Status>
  } else if (current.key === 'me') {
    content = <AdminMyAccount />
  } else {
    // reported (CHORONG-36), questions (AD-08 2차)는 그 작업이 올라오면 연결
    content = <Status>아직 준비 중인 메뉴예요</Status>
  }

  return (
    <>
      <Head>
        <Title>
          <Icon name="shield" size={28} />
          관리자
        </Title>
        <Who>
          <Tag $variant="acc">관리자</Tag>
          <b>{admin?.adminName ?? '-'}</b>
          <span>{ADMIN_ROLE_LABEL[admin?.adminRole] ?? admin?.adminRole ?? '-'}</span>
          <Expire>{formatTime(expiresAt)}까지</Expire>
          <Button $size="sm" $variant="ghost" onClick={handleSignOut} disabled={isSigningOut}>
            로그아웃
          </Button>
        </Who>
      </Head>
      <Grid>
        <Menu aria-label="관리자 메뉴">
          {sections.map((item) => {
            const count = countOf(item)
            return (
              <MenuLink key={item.label} to={item.key ? `/admin/${item.key}` : '/admin'} end={item.key === null}>
                {item.label}
                {count !== null && count !== undefined && (
                  <Count>
                    {item.countLabel} {count}
                  </Count>
                )}
              </MenuLink>
            )
          })}
        </Menu>
        <Content>{content}</Content>
      </Grid>
    </>
  )
}

export default AdminPage
