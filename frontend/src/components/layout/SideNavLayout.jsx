import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import styled, { css } from 'styled-components'
import { IconButton } from '../../styles/common'
import Icon from '../ui/Icon'

// 옆 메뉴 + 본문 두 칸 틀 (MY, 관리자가 같이 씀)
// 웹: 왼쪽 230px 메뉴(묶음 제목 + 링크, 스크롤해도 따라옴) / 900px 미만: 메뉴가 위에 가로 알약으로
// groups: [{ title, items: [{ to, label, end, count, countLabel }] }]
//   title이 없는 묶음: 묶음 제목 없이 링크만, 웹에서는 링크 글자 크기와 굵기를 묶음 제목과 같게 (밑줄 없음, MY '한눈에 보기')
//   end: 그 주소일 때만 현재 메뉴로 표시 (예: '/my'가 '/my/liked'에서도 켜지지 않게)
//   count: 0보다 크면 링크 옆 빨간 알약 (countLabel은 화면 낭독기용 이름)
//   children: [{ to, label, isActive }] 그 링크 아래로 펼치는 메뉴 (웹만, 900px 미만 가로 알약에는 안 보임)
//     링크 오른쪽 ∨ 버튼으로 펼치고 접음. 처음 상태는 defaultOpen (MY: 계산 기록 화면이면 펼침), 누른 뒤에는 누른 대로
//     isActive: 지금 보는 하위 메뉴 (주소의 ? 뒤까지 맞춰야 해서 부르는 쪽이 정함)
// activeTone: 현재 메뉴 글자색 'brand'(주황, 기본) / 'ink'(검정)
const Grid = styled.div`
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 40px;
  align-items: start;
  @media (max-width: 1179px) {
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 28px;
  }
  @media (max-width: 899px) {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
`

const Menu = styled.nav`
  position: sticky;
  top: 92px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  @media (max-width: 899px) {
    position: static;
    flex-flow: row wrap;
    gap: 6px;
  }
`

const MenuGroup = styled.div`
  display: flex;
  flex-direction: column;
  @media (max-width: 899px) {
    display: contents;
  }
`

const MenuTitle = styled.h4`
  margin-bottom: 4px;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--ink);
  font-size: var(--fs-base);
  font-weight: 800;
  @media (max-width: 899px) {
    display: none;
  }
`

const MenuLink = styled(NavLink)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 2px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 600;
  transition: color var(--t-fast);
  &:hover {
    color: var(--brand-text);
  }
  &.active {
    color: ${({ $activeTone }) => ($activeTone === 'ink' ? 'var(--ink)' : 'var(--brand-text)')};
    font-weight: 800;
  }
  ${({ $isTop }) =>
    $isTop &&
    css`
      @media (min-width: 900px) {
        color: var(--ink);
        font-size: var(--fs-base);
        font-weight: 800;
      }
    `}
  @media (max-width: 899px) {
    padding: 9px 14px;
    border-radius: var(--r-pill);
    background: var(--mist);
    font-size: var(--fs-sm);
    font-weight: 700;
    &.active {
      background: var(--ink);
      color: var(--paper);
    }
  }
`

// 하위 메뉴가 있는 링크 줄: 링크 + ∨ 버튼 (900px 미만은 링크만 알약으로)
const MenuRow = styled.div`
  display: flex;
  align-items: center;
  & > a {
    flex: 1;
  }
  @media (max-width: 899px) {
    display: contents;
  }
`

const ToggleButton = styled(IconButton)`
  svg {
    transition: transform var(--t-fast);
    transform: rotate(${({ $isOpen }) => ($isOpen ? '180deg' : '0deg')});
  }
  @media (max-width: 899px) {
    display: none;
  }
`

const SubList = styled.div`
  display: flex;
  flex-direction: column;
  padding-left: 14px;
  @media (max-width: 899px) {
    display: none;
  }
`

const SubLink = styled(Link)`
  padding: 6px 2px;
  color: ${({ $isActive }) => ($isActive ? 'var(--brand-text)' : 'var(--ink-2)')};
  font-size: var(--fs-sm);
  font-weight: ${({ $isActive }) => ($isActive ? 800 : 500)};
  transition: color var(--t-fast);
  &:hover {
    color: var(--brand-text);
  }
`

const Count = styled.span`
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: var(--r-sm);
  background: var(--bad);
  color: var(--on-bad);
  font-family: var(--f-num);
  font-size: var(--fs-xs);
  font-weight: 900;
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 48px;
  min-width: 0;
`

function SideNavLayout({ label, groups, activeTone = 'brand', children }) {
  // 하위 메뉴 펼침을 직접 바꾼 링크만 (to → true 펼침 / false 접음), 나머지는 defaultOpen
  const [openState, setOpenState] = useState({})

  const renderLink = (item, isTop) => (
    <MenuLink key={item.to} to={item.to} end={item.end} $activeTone={activeTone} $isTop={isTop}>
      {item.label}
      {item.count > 0 && <Count aria-label={`${item.countLabel} ${item.count}`}>{item.count}</Count>}
    </MenuLink>
  )

  return (
    <Grid>
      <Menu aria-label={label}>
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <MenuGroup key={group.title ?? group.items[0].to}>
              {group.title && <MenuTitle>{group.title}</MenuTitle>}
              {group.items.map((item) => {
                if (!item.children) return renderLink(item, !group.title)
                const isOpen = openState[item.to] ?? Boolean(item.defaultOpen)
                return (
                  <MenuGroup key={item.to}>
                    <MenuRow>
                      {renderLink(item, !group.title)}
                      <ToggleButton
                        aria-label={`${item.label} 하위 메뉴 ${isOpen ? '접기' : '펼치기'}`}
                        aria-expanded={isOpen}
                        $isOpen={isOpen}
                        onClick={() => setOpenState((prev) => ({ ...prev, [item.to]: !isOpen }))}
                      >
                        <Icon name="chevron_down" size={14} />
                      </ToggleButton>
                    </MenuRow>
                    {isOpen && (
                      <SubList>
                        {item.children.map((child) => (
                          <SubLink
                            key={child.to}
                            to={child.to}
                            $isActive={child.isActive}
                            aria-current={child.isActive ? 'page' : undefined}
                          >
                            {child.label}
                          </SubLink>
                        ))}
                      </SubList>
                    )}
                  </MenuGroup>
                )
              })}
            </MenuGroup>
          ),
        )}
      </Menu>
      <Content>{children}</Content>
    </Grid>
  )
}

export default SideNavLayout
