import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'
import { FULL_MENU } from '../../constants/menu'
import useUiStore from '../../store/useUiStore'
import Modal from '../ui/Modal'

// LY-15 모바일 전체 메뉴: Modal 부품 사용 (Esc, 뒤 막 클릭 → 닫힘)
// 링크를 누르면 닫히고, 열려 있는 동안 뒤 화면 스크롤을 잠금
const Group = styled.section`
  margin-bottom: 20px;
`

const GroupTitle = styled.h2`
  margin: 0 0 8px;
  color: var(--cocoa);
  font-size: var(--fs-md);
  font-weight: 600;
`

const MenuLink = styled(NavLink)`
  display: block;
  padding: 12px 0;
  color: var(--ink);
  font-size: var(--fs-lg);
  font-weight: 600;
  text-decoration: none;
  &.active {
    color: var(--brand-text);
    font-weight: 700;
  }
`

function MobileMenu() {
  const menuOpen = useUiStore((state) => state.menuOpen)
  const closeMenu = useUiStore((state) => state.closeMenu)

  useEffect(() => {
    if (!menuOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  return (
    <Modal isOpen={menuOpen} onClose={closeMenu} label="전체 메뉴">
      <nav aria-label="전체 메뉴">
        {FULL_MENU.map((group) => (
          <Group key={group.title}>
            <GroupTitle>{group.title}</GroupTitle>
            {group.items.map((item) => (
              <MenuLink key={item.to} to={item.to} end={item.end} onClick={closeMenu}>
                {item.label}
              </MenuLink>
            ))}
          </Group>
        ))}
      </nav>
    </Modal>
  )
}

export default MobileMenu
