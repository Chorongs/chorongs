import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import styled from 'styled-components'
import logoImg from '../../assets/images/logo_main.png'
import { FULL_MENU } from '../../constants/menu'
import useUiStore from '../../store/useUiStore'
import { IconButton } from '../../styles/common'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'

// LY-15 모바일 전체 메뉴: Modal 부품 사용 (Esc → 닫힘). 시안처럼 화면 가득, 위에 로고 + 닫기
// 링크를 누르면 닫히고, 열려 있는 동안 뒤 화면 스크롤을 잠금
// 캐링 추천은 LY-05와 같음 (추천받기 전이면 추천 창 열고 메뉴 닫기, 받은 뒤면 /recommend 이동)
// TODO(ST-03, CHORONG-45): useRecommendStore의 result가 올라오면 hasResult를 result 유무로 바꾼다.
// TODO(ST-01, CHORONG-43): 맨 위 계정 줄은 useAuthStore가 올라온 뒤 추가한다.
//   회원: '{닉네임}님' + '{카카오 또는 네이버} 로그인' → /my / 비회원: '카카오, 네이버로 로그인' + '찜과 기록은 회원만 저장돼요' → /login
const Top = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  margin-bottom: 12px;
`

const LogoImage = styled.img`
  display: block;
  height: 28px;
`

const Group = styled.section`
  padding: 18px 4px 8px;
  border-bottom: 1px solid var(--line);
  &:last-child {
    border-bottom: 0;
  }
`

const GroupTitle = styled.h2`
  margin-bottom: 6px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 800;
`

const MenuLink = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  color: var(--ink);
  font-size: var(--fs-lg);
  font-weight: 700;
  &.active {
    color: var(--brand-text);
  }
`

const MenuIcon = styled.span`
  display: inline-flex;
  color: var(--brand-text);
`

function MobileMenu() {
  const menuOpen = useUiStore((state) => state.menuOpen)
  const closeMenu = useUiStore((state) => state.closeMenu)
  const openRecommend = useUiStore((state) => state.openRecommend)
  const hasResult = false

  const handleItemClick = (event, item) => {
    closeMenu()
    if (item.isRecommend && !hasResult) {
      event.preventDefault()
      openRecommend()
    }
  }

  useEffect(() => {
    if (!menuOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [menuOpen])

  return (
    <Modal isOpen={menuOpen} onClose={closeMenu} label="전체 메뉴" isFull showClose={false}>
      <Top>
        <LogoImage src={logoImg} alt="캐링" />
        <IconButton aria-label="전체 메뉴 닫기" onClick={closeMenu}>
          <Icon name="close" />
        </IconButton>
      </Top>
      <nav aria-label="전체 메뉴">
        {FULL_MENU.map((group) => (
          <Group key={group.title}>
            <GroupTitle>{group.title}</GroupTitle>
            {group.items.map((item) => (
              <MenuLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={(event) => handleItemClick(event, item)}
              >
                <MenuIcon>
                  <Icon name={item.icon} />
                </MenuIcon>
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
