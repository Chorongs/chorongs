import { useState } from 'react'
import styled from 'styled-components'
import useMyStore from '../../store/useMyStore'
import useUiStore from '../../store/useUiStore'
import { Button, IconButton } from '../../styles/common'
import requireLogin from '../../utils/requireLogin'
import Icon from '../ui/Icon'

// CM-06 찜 버튼: 회원은 찜/찜 취소 + 알림, 비회원은 로그인 안내 창 (requireLogin)
// hasLabel: false(목록) 하트만 / true(상세 창) 글자 버튼
// 누르는 중 잠금 (E5). 성공했을 때만 하트가 바뀌므로 실패하면 원래 모양 그대로 + 알림 (E3)
// 상품 줄 안에서 눌러도 상세 창이 열리지 않게 클릭을 줄까지 안 퍼지게 함 (CM-04)
// TODO(API-20, CHORONG-42 BE): 찜 API는 오늘 서버 범위 밖이라 지금은 실패 알림이 뜸 (서버가 올라오면 그대로 동작)
const LOGIN_TEXT = '찜하기는 회원 전용이에요.'

const Heart = styled.span`
  display: inline-flex;
  color: ${({ $isLiked }) => ($isLiked ? 'var(--brand)' : 'var(--muted)')};
`

function LikeButton({ productId, hasLabel = false }) {
  const isLiked = useMyStore((state) => state.likedIds.includes(productId))
  const toggleLike = useMyStore((state) => state.toggleLike)
  const showToast = useUiStore((state) => state.showToast)
  const [isPending, setIsPending] = useState(false)

  const handleToggle = async () => {
    setIsPending(true)
    try {
      const nowLiked = await toggleLike(productId)
      showToast(nowLiked ? '찜했어요' : '찜을 취소했어요')
    } catch (error) {
      // 401은 axiosInstance가 로그인 안내 창을 띄움 (E4)
      if (error.response?.status === 401) return
      if (error.response?.data?.code === 'LIKE_FULL') showToast('찜은 30개까지 할 수 있어요. MY에서 정리해 주세요')
      else showToast('찜하지 못했어요. 다시 시도해 주세요')
    } finally {
      setIsPending(false)
    }
  }

  const handleClick = (event) => {
    event.stopPropagation()
    requireLogin(handleToggle, LOGIN_TEXT)
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
