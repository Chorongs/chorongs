import { Link } from 'react-router-dom'
import styled, { css } from 'styled-components'
import useAuthStore from '../../store/useAuthStore'
import useMyStore from '../../store/useMyStore'
import requireLogin from '../../utils/requireLogin'
import Icon from '../ui/Icon'

// LY-07 찜 바로가기: 하트 + 개수 딱지 (useMyStore likedIds 개수)
// 회원: /my/liked 이동 / 비회원: 로그인 안내 창, 개수 숨김
const boxStyle = css`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--ink-2);
  cursor: pointer;
  transition: background var(--t-fast);
  &:hover {
    background: var(--mist);
    color: var(--ink);
  }
`

const LinkBox = styled(Link)`
  ${boxStyle}
`

const ButtonBox = styled.button.attrs({ type: 'button' })`
  ${boxStyle}
`

const Badge = styled.span`
  position: absolute;
  top: 2px;
  right: 0;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--r-pill);
  background: var(--brand-strong);
  color: var(--on-brand);
  font-family: var(--f-num);
  font-size: var(--fs-2xs);
  font-weight: 700;
  line-height: 16px;
  text-align: center;
`

function LikeLink() {
  const status = useAuthStore((state) => state.status)
  const likedCount = useMyStore((state) => state.likedIds.length)

  if (status === 'member') {
    return (
      <LinkBox to="/my/liked" aria-label={`찜한 대출 ${likedCount}개`}>
        <Icon name="heart" />
        {likedCount > 0 && <Badge aria-hidden="true">{likedCount}</Badge>}
      </LinkBox>
    )
  }

  return (
    <ButtonBox aria-label="찜한 대출" onClick={() => requireLogin(() => {}, '찜하기는 회원 전용이에요.')}>
      <Icon name="heart" />
    </ButtonBox>
  )
}

export default LikeLink
