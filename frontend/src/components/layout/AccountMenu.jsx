import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import useAuthStore from '../../store/useAuthStore'
import { Button } from '../../styles/common'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import Popover from '../ui/Popover'

// LY-08 계정 메뉴: 비회원 [로그인] / 회원 닉네임 버튼 → 작은 메뉴 (MY, 로그아웃)
// 모바일(900px 미만)은 작은 메뉴 대신 /my 이동 / 바깥 클릭, Esc(Popover), 화면 이동(key=주소) 시 메뉴 닫기
// 로그아웃: 확인 창 '로그아웃할까요?' → API-16 + sessionStorage 비우기 → 안내 창 → 닫으면 새로고침하며 메인(/)으로
// (명세서는 메인 이동 뒤 알림이지만, 새로고침하면 메모리의 알림이 지워져서 안내 창을 먼저 띄움. 2026-11-17 사용자 결정)
// (안내 문구도 명세서 '…이 탭에 있던 입력값도 지웠어요' 대신 이동 안내로 바꿈. 2026-11-17 사용자 결정)
// TODO(LY-08, CHORONG-43 Tong B): 모바일(900px 미만) 동작은 웹 화면 확인 뒤 사용자 화면 테스트 때 다시 정함
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

const DialogText = styled.p`
  margin-bottom: 20px;
  font-size: var(--fs-lg);
  font-weight: 700;
`

const DialogActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

function AccountMenu() {
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // 로그아웃 창 단계: null 닫힘 / 'confirm' 확인 / 'done' 끝남 안내
  const [logoutStep, setLogoutStep] = useState(null)
  const [isPending, setIsPending] = useState(false)

  // 확인하는 동안은 아무것도 안 그림 (로그인 버튼이 번쩍 보이지 않게)
  if (status === 'checking') return null

  if (status !== 'member') {
    return (
      <Button $size="sm" $variant="outline" onClick={() => navigate('/login')}>
        로그인
      </Button>
    )
  }

  const handleLogout = async () => {
    setIsPending(true)
    await logout()
    setIsPending(false)
    setLogoutStep('done')
  }

  // 새로고침하며 메인으로: 메모리의 스토어 값(추천 결과, 비교함, 찜 등)이 한꺼번에 비워짐
  const handleDoneClose = () => window.location.replace('/')

  return (
    <>
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
                setLogoutStep('confirm')
              }}
            >
              로그아웃
            </button>
          </MenuList>
        )}
      </Popover>

      <Modal isOpen={logoutStep === 'confirm'} onClose={() => setLogoutStep(null)} label="로그아웃 확인" width={380} showClose={false}>
        <DialogText>로그아웃할까요?</DialogText>
        <DialogActions>
          <Button $variant="outline" onClick={() => setLogoutStep(null)}>
            취소
          </Button>
          <Button onClick={handleLogout} disabled={isPending}>
            로그아웃
          </Button>
        </DialogActions>
      </Modal>

      <Modal isOpen={logoutStep === 'done'} onClose={handleDoneClose} label="로그아웃 완료" width={380} showClose={false}>
        <DialogText>
          로그아웃했어요.
          <br />
          메인 페이지로 이동할게요
        </DialogText>
        <DialogActions>
          <Button onClick={handleDoneClose}>확인</Button>
        </DialogActions>
      </Modal>
    </>
  )
}

export default AccountMenu
