import { NavLink } from 'react-router-dom'
import styled from 'styled-components'
import { NAV_MENU } from '../../constants/menu'

// LY-05 상단 메뉴: 주요 메뉴 7개. NavLink로 이동하고 하위 주소도 현재 메뉴로 표시
// 메뉴 목록은 constants/menu.js (탭바, 전체 메뉴와 같이 씀) / 900px 미만은 하단 탭바가 대신함
const Nav = styled.nav`
  display: flex;
  gap: 4px;
  @media (max-width: 899px) {
    display: none;
  }
`

const StyledNavLink = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  border-radius: var(--r-sm);
  color: var(--muted);
  font-size: var(--fs-lg);
  font-weight: 600;
  text-decoration: none;
  transition: color var(--t-fast), background var(--t-fast);
  &:hover {
    color: var(--ink);
  }
  &.active {
    color: var(--brand-text);
    font-weight: 700;
  }
`

function GlobalNav() {
  return (
    <Nav aria-label="주요 메뉴">
      {NAV_MENU.map((item) => (
        <StyledNavLink key={item.to} to={item.to} end={item.end}>
          {item.label}
        </StyledNavLink>
      ))}
    </Nav>
  )
}

export default GlobalNav
