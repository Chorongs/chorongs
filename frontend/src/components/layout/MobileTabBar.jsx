import { NavLink } from 'react-router-dom'
import styled, { css } from 'styled-components'
import { TAB_MENU } from '../../constants/menu'
import useUiStore from '../../store/useUiStore'
import Icon from '../ui/Icon'

// LY-14 모바일 하단 탭바: 900px 미만에서만 보임 (높이 66 + 아이폰 하단 안전 영역 여백)
// 추천 / 상품 찾기 / 비교 / 계산기 / 전체 (전체 → 전체 메뉴 열기)
// 시안처럼 아이콘 위, 글자 아래. 현재 탭은 진한 글자 + 주황 아이콘
const Bar = styled.nav`
  display: none;
  @media (max-width: 899px) {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 55;
    display: flex;
    height: calc(66px + env(safe-area-inset-bottom));
    padding: 6px max(6px, env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom))
      max(6px, env(safe-area-inset-left));
    border-top: 1px solid var(--line);
    background: var(--paper);
  }
`

const tabStyle = css`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 5px 0 3px;
  border-radius: var(--r-sm);
  color: var(--muted);
  font-size: var(--fs-2xs);
  font-weight: 700;
`

const IconBox = styled.span`
  display: inline-flex;
`

const TabLink = styled(NavLink)`
  ${tabStyle}
  &.active {
    color: var(--ink);
  }
  &.active ${IconBox} {
    color: var(--brand);
  }
`

const MoreButton = styled.button.attrs({ type: 'button' })`
  ${tabStyle}
  &[aria-expanded='true'] {
    color: var(--ink);
  }
  &[aria-expanded='true'] ${IconBox} {
    color: var(--brand);
  }
`

function MobileTabBar() {
  const menuOpen = useUiStore((state) => state.menuOpen)
  const openMenu = useUiStore((state) => state.openMenu)

  return (
    <Bar aria-label="하단 메뉴">
      {TAB_MENU.map((item) => (
        <TabLink key={item.to} to={item.to} end={item.end}>
          <IconBox>
            <Icon name={item.icon} size={23} />
          </IconBox>
          {item.label}
        </TabLink>
      ))}
      <MoreButton aria-haspopup="dialog" aria-expanded={menuOpen} onClick={openMenu}>
        <IconBox>
          <Icon name="grid" size={23} />
        </IconBox>
        전체
      </MoreButton>
    </Bar>
  )
}

export default MobileTabBar
