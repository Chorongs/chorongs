import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import useAdminStore, { ADMIN_LOGGED_IN_TEXT } from '../../store/useAdminStore'
import useAuthStore from '../../store/useAuthStore'
import useUiStore from '../../store/useUiStore'
import { Button } from '../../styles/common'
import ConfirmDialog from '../common/ConfirmDialog'
import Icon from '../ui/Icon'
import Popover from '../ui/Popover'

// LY-08 계정 메뉴: 비회원 [로그인] / 회원 닉네임 버튼 → 작은 메뉴 (MY, 로그아웃)
// 모바일(900px 미만)은 작은 메뉴 대신 /my 이동 / 바깥 클릭, Esc(Popover), 화면 이동(key=주소) 시 메뉴 닫기
// 로그아웃: 메뉴는 창 열기(openLogout)만. 창은 아래 LogoutDialog를 Layout이 한 번만 그림
//   (상단바(z-index 50) 안에서 그리면 하단 탭바(55), 비교함 띠(58) 아래에 깔려서. UI-15 'createPortal 안 쓰고 Layout에서 그림')
// LogoutDialog: 확인 창 '로그아웃할까요?' → API-16 + sessionStorage 비우기 → 안내 창 → 닫으면 새로고침하며 메인(/)으로
// (새로고침하면 메모리의 알림이 지워지므로 알림 대신 안내 창을 먼저 띄움)
// TODO(LY-08): 모바일(900px 미만) 동작은 웹 화면 확인 뒤 사용자 화면 테스트 때 다시 정함
const MOBILE_QUERY = '(max-width: 899px)'

const NameButton = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  max-width: 160px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--r-sm);
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
`

const MenuList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  a,
  button {
    padding: 8px 4px;
    border: 0;
    background: transparent;
    color: var(--ink);
    font-size: var(--fs-base);
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  a:hover,
  button:hover {
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
          <span>{user.memberNickname}</span>
          <Icon name="chevron_down" size={13} />
        </NameButton>
      )}
    >
      {(close) => (
        <MenuList>
          <Link to="/my" onClick={close}>
            MY
          </Link>
          <button
            type="button"
            onClick={() => {
              close()
              openLogout()
            }}
          >
            로그아웃
          </button>
        </MenuList>
      )}
    </Popover>
  )
}

export default AccountMenu
