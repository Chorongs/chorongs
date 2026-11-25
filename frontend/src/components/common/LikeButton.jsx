import { useState } from 'react'
import styled from 'styled-components'
import useMyStore, { LIKE_MAX } from '../../store/useMyStore'
import useUiStore from '../../store/useUiStore'
import { Button, IconButton } from '../../styles/common'
import requireLogin, { LIKE_LOGIN_TEXT } from '../../utils/requireLogin'
import Icon from '../ui/Icon'

// CM-06 찜 버튼: 회원은 찜/찜 취소 + 알림, 비회원은 로그인 안내 창 (requireLogin)
// hasLabel: false(목록) 하트만 / true(상세 창) 글자 버튼
// 누르는 중 잠금 (E5). 성공했을 때만 하트가 바뀌므로 실패하면 원래 모양 그대로 + 알림 (E3)
// 상품 줄 안에서 눌러도 상세 창이 열리지 않게 클릭을 줄까지 안 퍼지게 함 (CM-04)
const LIKE_FULL_TEXT = '찜은 30개까지 할 수 있어요. MY에서 정리해 주세요'

const Heart = styled.span`
  display: inline-flex;
  color: ${({ $isLiked }) => ($isLiked ? 'var(--brand)' : 'var(--muted)')};
`

function LikeButton({ productId, hasLabel = false }) {
  const isLiked = useMyStore((state) => state.likedIds.includes(productId))
  const isFull = useMyStore((state) => state.likedIds.length >= LIKE_MAX)
  const toggleLike = useMyStore((state) => state.toggleLike)
  const showToast = useUiStore((state) => state.showToast)
  const [isPending, setIsPending] = useState(false)

  const handleToggle = async () => {
    // 이미 30개면 보내지 않고 바로 안내 (서버도 409 LIKE_FULL로 막음, 찜 목록을 못 불러왔을 때를 위해 아래에서도 처리)
    if (!isLiked && isFull) {
      showToast(LIKE_FULL_TEXT)
      return
    }
    setIsPending(true)
    try {
      const nowLiked = await toggleLike(productId)
      showToast(nowLiked ? '찜했어요' : '찜을 취소했어요')
    } catch (error) {
      // 401은 axiosInstance가 로그인 안내 창을 띄움 (E4)
      if (error.response?.status === 401) return
      if (error.response?.data?.code === 'LIKE_FULL') showToast(LIKE_FULL_TEXT)
      else showToast('찜하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  const handleClick = (event) => {
    event.stopPropagation()
    requireLogin(handleToggle, LIKE_LOGIN_TEXT)
  }

  const label = isLiked ? '찜 취소' : '찜하기'
  const heart = (
    <Heart $isLiked={isLiked}>
      <Icon name="heart" size={hasLabel ? 16 : 18} />
    </Heart>
  )

  if (hasLabel) {
    return (
      <Button $variant="outline" onClick={handleClick} disabled={isPending} aria-pressed={isLiked}>
        {heart}
        {label}
      </Button>
    )
  }

  return (
    <IconButton aria-label={label} aria-pressed={isLiked} onClick={handleClick} disabled={isPending}>
      {heart}
    </IconButton>
  )
}

export default LikeButton
