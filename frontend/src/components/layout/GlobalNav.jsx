import { Link, NavLink, matchPath, useLocation } from 'react-router-dom'
import styled from 'styled-components'
import { NAV_MENU } from '../../constants/menu'
import useUiStore from '../../store/useUiStore'

// LY-05 상단 메뉴: 주요 메뉴 7개. NavLink로 이동하고 하위 주소도 현재 메뉴로 표시
// 메뉴 목록은 constants/menu.js (탭바, 전체 메뉴와 같이 씀) / 900px 미만은 하단 탭바가 대신함
// 시안처럼 7칸이 같은 너비이고, 메뉴에 마우스를 올리면(키보드 포커스도) 모든 하위 메뉴가 한꺼번에 아래로 펼쳐진다.
// 하위 메뉴 펼침은 1180px 이상에서만 (더 좁으면 펼치지 않음)
// 펼침 여부는 Header가 관리 (isMegaOpen, onMegaChange) - 펼친 배경판도 Header가 그린다.
// 캐링 추천: 추천받기 전이면 추천 창 열기 (주소 그대로), 받은 뒤면 /recommend 이동
// TODO(ST-03, CHORONG-45): useRecommendStore의 result가 올라오면 hasResult를 result 유무로 바꾸고, 받은 뒤 메뉴 이름을 '추천 결과'로 보인다.
const MEGA_MIN_WIDTH = 1180

const canExpand = () => window.matchMedia(`(min-width: ${MEGA_MIN_WIDTH}px)`).matches
const Nav = styled.nav`
  display: grid;
  flex: 1;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  max-width: 920px;
  height: 100%;
  min-width: 0;
  @media (max-width: 899px) {
    display: none;
  }
`

const Item = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
`

// 현재 메뉴: 진한 글자 + 아래 주황 3px 밑줄
const StyledNavLink = styled(NavLink)`
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 12px;
  color: var(--ink-2);
  font-size: var(--fs-base);
  font-weight: 600;
  white-space: nowrap;
  &:hover {
    color: var(--ink);
  }
  &.active,
  &[data-active='true'] {
    color: var(--ink);
    font-weight: 800;
  }
  &.active::after,
  &[data-active='true']::after {
    content: '';
    position: absolute;
    right: 12px;
    bottom: -1px;
    left: 12px;
    height: 3px;
    border-radius: 3px 3px 0 0;
    background: var(--brand);
  }
  @media (max-width: 1100px) {
    font-size: var(--fs-md);
  }
`

const Sub = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 0 20px;
  visibility: ${({ $isOpen }) => ($isOpen ? 'visible' : 'hidden')};
  @media (max-width: ${MEGA_MIN_WIDTH - 1}px) {
    display: none;
  }
`

const SubLink = styled(Link)`
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 4px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 600;
  white-space: nowrap;
  &:hover {
    color: var(--brand-text);
  }
  @media (max-width: 1279px) {
    font-size: var(--fs-sm);
  }
`

function GlobalNav({ isMegaOpen, onMegaChange }) {
  const { pathname } = useLocation()
  const openRecommend = useUiStore((state) => state.openRecommend)
  const hasResult = false

  const handleExpand = () => {
    if (canExpand()) onMegaChange(true)
  }

  const handleItemClick = (event, item) => {
    onMegaChange(false)
    if (item.isRecommend && !hasResult) {
      event.preventDefault()
      openRecommend()
    }
  }

  return (
    <Nav aria-label="주요 메뉴" onMouseEnter={handleExpand} onFocus={handleExpand}>
      {NAV_MENU.map((item) => (
        <Item key={item.to}>
          <StyledNavLink
            to={item.to}
            end={item.end}
            data-active={item.match ? Boolean(matchPath({ path: item.match, end: false }, pathname)) : undefined}
            onClick={(event) => handleItemClick(event, item)}
          >
            {item.label}
          </StyledNavLink>
          {item.children && (
            <Sub $isOpen={isMegaOpen}>
              {item.children.map((child) => (
                <SubLink key={child.to} to={child.to} onClick={() => onMegaChange(false)}>
                  {child.label}
                </SubLink>
              ))}
            </Sub>
          )}
        </Item>
      ))}
    </Nav>
  )
}

export default GlobalNav
