import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styled from 'styled-components'
import * as authApi from '../../api/authApi'
import kakaoSymbol from '../../assets/images/kakao_symbol.svg'
import naverSymbol from '../../assets/images/naver_symbol.png'
import useAuthStore from '../../store/useAuthStore'
import useUiStore from '../../store/useUiStore'
import { Button } from '../../styles/common'
import Modal from '../ui/Modal'

// CM-17 로그인 안내 창: 회원 전용 기능 안내 (Layout에서 한 번만 그림, 다른 팝업 위 z-index 91)
// requireLogin(CM-22), 401(E4)이 상황 글과 함께 엶 (useUiStore.openLoginDialog)
// [카카오 로그인], [네이버 로그인] → 지금 주소를 돌아올 주소로 기억하고 바로 소셜 로그인 (API-18, /login 거치지 않음)
// [취소] → 창만 닫기 / 열리면 [카카오 로그인]에 커서 (위쪽 닫기 버튼을 안 그려서 첫 버튼이 카카오)
// 소셜 버튼: 카카오 로그인 디자인 가이드의 문구('카카오 로그인' 또는 '로그인')와 받은 네이버 공식 리소스 문구('네이버 로그인')를 따름
//   (명세서의 '카카오로 계속하기', '카카오로 로그인' 대신. 2026-11-17 사용자 결정 B, 문서_반영_목록)
//   심볼은 공식 파일 그대로(모양, 비율, 색 변경 금지), 글자가 있으니 alt=""(꾸밈 그림)
const Title = styled.h2`
  margin-bottom: 8px;
  font-size: var(--fs-h3);
  font-weight: 800;
`

// 안내와 해야 할 행동이 두 문장이면 두 줄로 나눔 (글 안의 \n, white-space: pre-line. 2026-11-17 사용자 요청)
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
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [loginDialogOpen])

  const handleClose = () => useUiStore.setState({ loginDialogOpen: false })

  // 돌아올 주소 검사(사이트 안 주소만, E12)는 getLoginUrl이 함
  // 누르는 순간 서버(API-17)에 한 번 더 확인: 이미 로그인 중이면 소셜 로그인으로 보내지 않고 창을 닫음
  //   + '이미 로그인되어 있어요' + 로그인 상태를 다시 채움 (다시 로그인, 다른 계정 가입 막음)
  // 서버 응답이 아예 없으면(서버 꺼짐, 네트워크 오류) 소셜 로그인으로 보내도 오류 화면만 뜨므로 보내지 않고 다시 시도 안내 (E3, 창은 열어 둠)
  const handleLogin = async (provider) => {
    setIsChecking(true)
    let me = null
    try {
      me = await authApi.getMe()
    } catch (error) {
      if (!error.response) {
        setIsChecking(false)
        showToast('로그인하지 못했어요. 다시 시도해 주세요')
        return
      }
      // 401 등 서버 응답이 있으면 비회원 → 아래에서 소셜 로그인으로 보냄
    }
    setIsChecking(false)
    if (me?.memberNickname) {
      handleClose()
      showToast('이미 로그인되어 있어요')
      useAuthStore.getState().fetchMe()
      return
    }
    authApi.getLoginUrl(provider, `${pathname}${search}`)
  }

  return (
    <Modal isOpen={loginDialogOpen} onClose={handleClose} label="로그인이 필요해요" width={420} isTop showClose={false}>
      <Title>로그인이 필요해요</Title>
      <Desc>{`${loginDialogText}\n카카오, 네이버 계정으로 간단하게 로그인할 수 있어요.`}</Desc>
      <Actions>
        <Button $variant="kakao" onClick={() => handleLogin('kakao')} disabled={isChecking}>
          <img src={kakaoSymbol} alt="" />
          카카오 로그인
        </Button>
        <Button $variant="naver" onClick={() => handleLogin('naver')} disabled={isChecking}>
          <img src={naverSymbol} alt="" />
          네이버 로그인
        </Button>
        <Button $variant="ghost" onClick={handleClose}>
          취소
        </Button>
      </Actions>
    </Modal>
  )
}

export default LoginRequiredDialog
