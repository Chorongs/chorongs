import { NavLink } from 'react-router-dom'
import styled, { css } from 'styled-components'
import { TAB_MENU } from '../../constants/menu'
import useUiStore from '../../store/useUiStore'

// LY-14 모바일 하단 탭바: 900px 미만에서만 보임 (높이 66 + 아이폰 하단 안전 영역 여백)
// 추천 / 상품 찾기 / 비교 / 계산기 / 전체 (전체 → 전체 메뉴 열기)
const Bar = styled.nav`
  display: none;
  @media (max-width: 899px) {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 55;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    height: calc(66px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    border-top: 1px solid var(--line);
    background: var(--paper);
  }
`

const tabStyle = css`
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: var(--fs-md);
  font-weight: 600;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
`

const TabLink = styled(NavLink)`
  ${tabStyle}
  &.active {
    color: var(--brand-text);
    font-weight: 700;
  }
`

const MoreButton = styled.button`
  ${tabStyle}
  &[aria-expanded='true'] {
    color: var(--brand-text);
    font-weight: 700;
  }
`

function MobileTabBar() {
  const menuOpen = useUiStore((state) => state.menuOpen)
  const openMenu = useUiStore((state) => state.openMenu)

  return (
    <Bar aria-label="하단 메뉴">
      {TAB_MENU.map((item) => (
        <TabLink key={item.to} to={item.to} end={item.end}>
          {item.label}
        </TabLink>
      ))}
      <MoreButton type="button" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={openMenu}>
        전체
      </MoreButton>
    </Bar>
  )
}

export default MobileTabBar
