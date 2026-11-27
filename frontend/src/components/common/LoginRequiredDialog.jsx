import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styled from 'styled-components'
import * as authApi from '../../api/authApi'
import useUiStore from '../../store/useUiStore'
import { Button } from '../../styles/common'
import {
  ADMIN_LOGIN_GUIDE_TEXT,
  ALREADY_LOGGED_IN_TEXT,
  LOGIN_OFFLINE_TEXT,
  checkSocialLogin,
  rememberOpenProduct,
} from '../../utils/requireLogin'
import { lockScroll, unlockScroll } from '../../utils/scrollLock'
import SocialLoginButtons from '../auth/SocialLoginButtons'
import Modal from '../ui/Modal'

// CM-17 로그인 안내 창: 회원 전용 기능 안내 (Layout에서 한 번만 그림, 다른 팝업 위 z-index 91)
// requireLogin(CM-22), 401(E4)이 상황 글과 함께 엶 (useUiStore.openLoginDialog)
// [카카오 로그인], [네이버 로그인] → 지금 주소를 돌아올 주소로 기억하고 바로 소셜 로그인 (API-18, /login 거치지 않음)
// [취소] → 창만 닫기 / 열리면 [카카오 로그인]에 커서 (위쪽 닫기 버튼을 안 그려서 첫 버튼이 카카오)
// 소셜 버튼은 로그인 화면과 같은 SocialLoginButtons
const Title = styled.h2`
  margin-bottom: 8px;
  font-size: var(--fs-h3);
  font-weight: 800;
`

// 안내와 해야 할 행동이 두 문장이면 두 줄로 나눔 (글 안의 \n, white-space: pre-line)
const Desc = styled.p`
  margin-bottom: 20px;
  color: var(--cocoa);
  white-space: pre-line;
`

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

function LoginRequiredDialog() {
  const loginDialogOpen = useUiStore((state) => state.loginDialogOpen)
  const loginDialogText = useUiStore((state) => state.loginDialogText)
  const showToast = useUiStore((state) => state.showToast)
  const { pathname, search } = useLocation()
  // 로그인 여부를 다시 확인하는 동안 버튼 잠금 (E5)
  const [isChecking, setIsChecking] = useState(false)

  // 열려 있는 동안 뒤 화면 스크롤 잠금
  useEffect(() => {
    if (!loginDialogOpen) return undefined
    lockScroll()
    return unlockScroll
  }, [loginDialogOpen])

  const handleClose = () => useUiStore.setState({ loginDialogOpen: false })

  // 돌아올 주소 검사(사이트 안 주소만, E12)는 getLoginUrl이 함
  // 보내기 전 확인은 checkSocialLogin: 이미 로그인 중, 관리자 세션이면 창을 닫고 알림 / 서버 응답 없음 → 창은 열어 두고 다시 시도 알림
  const handleLogin = async (provider) => {
    setIsChecking(true)
    const check = await checkSocialLogin()
    setIsChecking(false)
    if (check === 'offline') {
      showToast(LOGIN_OFFLINE_TEXT)
      return
    }
    if (check === 'member' || check === 'admin') {
      handleClose()
      showToast(check === 'member' ? ALREADY_LOGGED_IN_TEXT : ADMIN_LOGIN_GUIDE_TEXT)
      return
    }
    // 상품 상세 창 위에서 열렸으면 돌아온 뒤 그 상세를 다시 열도록 적어 둠 (다시 여는 쪽은 Layout)
    rememberOpenProduct(pathname)
    authApi.getLoginUrl(provider, `${pathname}${search}`)
  }

  return (
    <Modal isOpen={loginDialogOpen} onClose={handleClose} label="로그인이 필요해요" width={420} isTop showClose={false}>
      <Title>로그인이 필요해요</Title>
      <Desc>{`${loginDialogText}\n카카오, 네이버 계정으로 간단하게 로그인할 수 있어요.`}</Desc>
      <Actions>
        <SocialLoginButtons onLogin={handleLogin} disabled={isChecking} />
        <Button $variant="ghost" onClick={handleClose}>
          취소
        </Button>
      </Actions>
    </Modal>
  )
}

export default LoginRequiredDialog
