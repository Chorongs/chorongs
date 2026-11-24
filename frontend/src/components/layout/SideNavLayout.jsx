import { NavLink } from 'react-router-dom'
import styled from 'styled-components'

// 옆 메뉴 + 본문 두 칸 틀 (MY, 관리자가 같이 씀)
// 웹: 왼쪽 230px 메뉴(묶음 제목 + 링크, 스크롤해도 따라옴) / 900px 미만: 메뉴가 위에 가로 알약으로
// groups: [{ title, items: [{ to, label, end, count, countLabel }] }]
//   end: 그 주소일 때만 현재 메뉴로 표시 (예: '/my'가 '/my/liked'에서도 켜지지 않게)
//   count: 0보다 크면 링크 옆 빨간 알약 (countLabel은 화면 낭독기용 이름)
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
  return (
    <Grid>
      <Menu aria-label={label}>
        {groups.map((group) =>
          group.items.length === 0 ? null : (
            <MenuGroup key={group.title}>
              <MenuTitle>{group.title}</MenuTitle>
              {group.items.map((item) => (
                <MenuLink key={item.to} to={item.to} end={item.end} $activeTone={activeTone}>
                  {item.label}
                  {item.count > 0 && <Count aria-label={`${item.countLabel} ${item.count}`}>{item.count}</Count>}
                </MenuLink>
              ))}
            </MenuGroup>
          ),
        )}
      </Menu>
      <Content>{children}</Content>
    </Grid>
  )
}

export default SideNavLayout
