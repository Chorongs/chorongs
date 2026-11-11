import { Link } from 'react-router-dom'
import styled from 'styled-components'
import logoImg from '../../assets/images/logo_main.png'
import GlobalNav from './GlobalNav'
import HelperToggle from './HelperToggle'

// LY-04 상단바: 맨 위 고정 바 (높이 68, 모바일 58)
// 로고 / 상단 메뉴 / 도우미 버튼 / 찜 바로가기 / 계정 메뉴
// TODO: 찜 바로가기 LikeLink(LY-07), 계정 메뉴 AccountMenu(LY-08)는 CHORONG-43에서 올라온 뒤 오른쪽 묶음에 연결 (useAuthStore)
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
  @media (max-width: 899px) {
    height: 58px;
  }
`

const Logo = styled(Link)`
  display: block;
  flex-shrink: 0;
  width: 88px;
  height: 44px;
`

const LogoImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
`

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
`

function Header() {
  return (
    <Bar>
      <Inner>
        <Logo to="/">
          <LogoImage src={logoImg} alt="캐링" />
        </Logo>
        <GlobalNav />
        <Right>
          <HelperToggle />
        </Right>
      </Inner>
    </Bar>
  )
}

export default Header
