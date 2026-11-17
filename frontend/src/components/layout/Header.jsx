import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import logoImg from '../../assets/images/logo_main.png'
import { NAV_MENU } from '../../constants/menu'
import GlobalNav from './GlobalNav'
import HelperToggle from './HelperToggle'

// LY-04 상단바: 맨 위 고정 바 (높이 68, 모바일 58)
// 로고 / 상단 메뉴 / 도우미 버튼 / 찜 바로가기 / 계정 메뉴
// 상단 메뉴에 마우스를 올리면 하위 메뉴가 펼쳐지고, 바 아래에 흰 배경판이 같이 내려온다. (Esc, 바 밖으로 나가면 닫힘)
// TODO(LY-07, LY-08, CHORONG-43): 찜 바로가기 LikeLink, 계정 메뉴 AccountMenu가 올라온 뒤 오른쪽 묶음에 연결 (useAuthStore)

// 펼친 배경판 높이 = 가장 긴 하위 메뉴 칸 (위 16 + 아래 20 + 줄 36 x 개수 + 줄 사이 4)
const MAX_CHILDREN = Math.max(...NAV_MENU.map((item) => item.children?.length ?? 0))
const MEGA_HEIGHT = 16 + 20 + MAX_CHILDREN * 36 + (MAX_CHILDREN - 1) * 4

const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
`

const Inner = styled.div`
  display: flex;
  align-items: center;
  gap: 28px;
  width: min(100% - 32px, 1304px);
  height: 68px;
  margin: 0 auto;
  @media (min-width: 768px) {
    width: min(100% - 64px, 1304px);
  }
  @media (max-width: 1100px) {
    gap: 16px;
  }
  @media (max-width: 899px) {
    height: 58px;
  }
`

const Logo = styled(Link)`
  display: flex;
  flex: none;
  align-items: center;
  padding: 4px 0;
`

const LogoImage = styled.img`
  display: block;
  height: 34px;
  @media (max-width: 899px) {
    height: 30px;
  }
`

const Right = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
  margin-left: auto;
`

const MegaBackground = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  display: ${({ $isOpen }) => ($isOpen ? 'block' : 'none')};
  height: ${MEGA_HEIGHT}px;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
  box-shadow: var(--shadow-pop);
`

function Header() {
  const [isMegaOpen, setIsMegaOpen] = useState(false)

  // Esc로 닫기
  useEffect(() => {
    if (!isMegaOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMegaOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMegaOpen])

  // 바 밖으로 마우스나 키보드 커서가 나가면 닫기
  const handleBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setIsMegaOpen(false)
  }

  return (
    <Bar onMouseLeave={() => setIsMegaOpen(false)} onBlur={handleBlur}>
      <Inner>
        <Logo to="/" aria-label="캐링 홈으로">
          <LogoImage src={logoImg} alt="캐링" />
        </Logo>
        <GlobalNav isMegaOpen={isMegaOpen} onMegaChange={setIsMegaOpen} />
        <Right>
          <HelperToggle />
        </Right>
      </Inner>
      <MegaBackground $isOpen={isMegaOpen} aria-hidden="true" />
    </Bar>
  )
}

export default Header
