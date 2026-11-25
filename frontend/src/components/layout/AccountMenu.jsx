import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { MY_MENU_GROUPS, getMyMenuPath } from '../../constants/menu'
import { LOGIN_TYPE_LABEL } from '../../constants/options'
import useAdminStore, { ADMIN_LOGGED_IN_TEXT } from '../../store/useAdminStore'
import useAuthStore from '../../store/useAuthStore'
import useMyStore from '../../store/useMyStore'
import useUiStore from '../../store/useUiStore'
import { Button, CountBadge } from '../../styles/common'
import ConfirmDialog from '../common/ConfirmDialog'
import Icon from '../ui/Icon'
import Popover from '../ui/Popover'

// LY-08 계정 메뉴: 비회원 [로그인] / 회원 '{닉네임}님' 버튼 → 작은 메뉴
//   윗줄 '{닉네임}님', '{카카오|네이버} 로그인' + [로그아웃] / 아래 MY 메뉴 링크 (MY 왼쪽 메뉴와 같은 MY_MENU_GROUPS)
//   제목 없는 묶음(한눈에 보기, 이 메뉴에서만 글은 '마이페이지', 누르면 /my)은 한 줄 전체, 제목 있는 묶음(내 기록, 계정)은 한 칸씩 2칸
//   '찜한 대출' 옆에 찜 개수 (상단 찜 하트와 같은 딱지 CountBadge, 0이면 안 보임)
// 모바일(900px 미만)은 작은 메뉴 대신 /my 이동 / 바깥 클릭, Esc(Popover), 화면 이동(key=주소) 시 메뉴 닫기
// 로그아웃: 메뉴는 창 열기(openLogout)만. 창은 아래 LogoutDialog를 Layout이 한 번만 그림
//   (상단바(z-index 50) 안에서 그리면 하단 탭바(55), 비교함 띠(58) 아래에 깔려서. UI-15 'createPortal 안 쓰고 Layout에서 그림')
// LogoutDialog: 확인 창 '로그아웃할까요?' → API-16 + sessionStorage 비우기 → 안내 창 → 닫으면 새로고침하며 메인(/)으로
// (새로고침하면 메모리의 알림이 지워지므로 알림 대신 안내 창을 먼저 띄움)
const MOBILE_QUERY = '(max-width: 899px)'
// 한눈에 보기(key null, /my) 링크의 이 메뉴 안 글
const MY_HOME_LABEL = '마이페이지'

const NameButton = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  max-width: 180px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--ink);
  font-size: var(--fs-md);
  font-weight: 700;
  cursor: pointer;
  &:hover {
    background: var(--mist);
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  svg {
    flex: none;
    color: var(--cocoa);
  }
`

// 메뉴 판: 2칸 (윗줄과 제목 없는 묶음은 두 칸 전체)
const MenuPanel = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  width: 376px;
  max-width: calc(100vw - 76px);
`

const Who = styled.div`
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
  div {
    min-width: 0;
  }
  b {
    display: block;
    overflow: hidden;
    font-size: var(--fs-lg);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    color: var(--cocoa);
    font-size: var(--fs-sm);
  }
  button {
    flex: none;
    margin-left: auto;
  }
`

const MenuGroup = styled.div`
  display: flex;
  flex-direction: column;
  ${({ $isTop }) => $isTop && 'grid-column: 1 / -1;'}
`

// 묶음 제목, 링크의 여백은 MY 왼쪽 메뉴(SideNavLayout)와 같음
const MenuTitle = styled.h4`
  margin-bottom: 4px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--ink);
  font-size: var(--fs-base);
  font-weight: 800;
`

const MenuLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 2px;
  color: ${({ $isTop }) => ($isTop ? 'var(--ink)' : 'var(--ink-2)')};
  font-size: ${({ $isTop }) => ($isTop ? 'var(--fs-base)' : 'var(--fs-md)')};
  font-weight: ${({ $isTop }) => ($isTop ? 800 : 500)};
  &:hover {
    color: var(--brand-text);
  }
`


// 로그아웃 창 (LY-08, MY-02 같이 씀). Layout이 한 번만 그림
export function LogoutDialog() {
  const logoutOpen = useUiStore((state) => state.logoutOpen)
  const closeLogout = useUiStore((state) => state.closeLogout)
  const logout = useAuthStore((state) => state.logout)
  const [isPending, setIsPending] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const handleLogout = async () => {
    setIsPending(true)
    await logout()
    setIsPending(false)
    setIsDone(true)
  }

  // 새로고침하며 메인으로: 메모리의 스토어 값(추천 결과, 비교함, 찜 등)이 한꺼번에 비워짐
  const handleDoneClose = () => window.location.replace('/')

  return (
    <>
      <ConfirmDialog
        isOpen={logoutOpen && !isDone}
        onClose={closeLogout}
        label="로그아웃 확인"
        title="로그아웃할까요?"
        confirmLabel="로그아웃"
        onConfirm={handleLogout}
        isConfirmDisabled={isPending}
      />

      <ConfirmDialog
        isOpen={isDone}
        onClose={handleDoneClose}
        label="로그아웃 완료"
        title={
          <>
            로그아웃했어요.
            <br />
            메인 페이지로 이동할게요
          </>
        }
        confirmLabel="확인"
        onConfirm={handleDoneClose}
        cancelLabel={null}
      />
    </>
  )
}

function AccountMenu() {
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const openLogout = useUiStore((state) => state.openLogout)
  const showToast = useUiStore((state) => state.showToast)
  const isAdminAuthed = useAdminStore((state) => state.status) === 'authed'
  const likedCount = useMyStore((state) => state.likedIds.length)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // 확인하는 동안(checking)에도 [로그인]을 보여 줌: 서버 응답이 늦거나 없어도 버튼이 사라지지 않게
  // 누르면 /login으로 가고, 로그인 화면이 버튼을 누르는 순간 서버에 다시 확인함. 회원이면 응답이 오자마자 닉네임 버튼으로 바뀜
  // 관리자로 로그인 중이면 /login으로 보내지 않고 알림 (SCR-16 비고)
  if (status !== 'member') {
    return (
      <Button
        $size="sm"
        $variant="outline"
        onClick={() => (isAdminAuthed ? showToast(ADMIN_LOGGED_IN_TEXT) : navigate('/login'))}
      >
        로그인
      </Button>
    )
  }

  return (
    <Popover
      key={pathname}
      renderTrigger={({ isOpen, toggle }) => (
        <NameButton
          aria-label={`${user.memberNickname} 계정 메뉴`}
          aria-expanded={isOpen}
          onClick={() => (window.matchMedia(MOBILE_QUERY).matches ? navigate('/my') : toggle())}
        >
          <span>{user.memberNickname}님</span>
          <Icon name="chevron_down" size={16} />
        </NameButton>
      )}
    >
      {(close) => (
        <MenuPanel>
          <Who>
            <div>
              <b>{user.memberNickname}님</b>
              <small>{LOGIN_TYPE_LABEL[user.loginType] ?? user.loginType} 로그인</small>
            </div>
            <Button
              $size="sm"
              $variant="outline"
              onClick={() => {
                close()
                openLogout()
              }}
            >
              로그아웃
            </Button>
          </Who>
          {MY_MENU_GROUPS.map((group) => (
            <MenuGroup key={group.title ?? 'top'} $isTop={!group.title}>
              {group.title && <MenuTitle>{group.title}</MenuTitle>}
              {group.items.map((item) => (
                <MenuLink key={item.label} to={getMyMenuPath(item.key)} $isTop={!group.title} onClick={close}>
                  {item.key === null ? MY_HOME_LABEL : item.label}
                  {item.key === 'liked' && likedCount > 0 && <CountBadge>{likedCount}</CountBadge>}
                </MenuLink>
              ))}
            </MenuGroup>
          ))}
        </MenuPanel>
      )}
    </Popover>
  )
}

export default AccountMenu
