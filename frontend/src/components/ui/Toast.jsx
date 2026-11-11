import { useEffect, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import useUiStore from '../../store/useUiStore'

// UI-21 알림 메시지: 화면 아래 짧은 글, 2.4초 뒤 사라짐 (새 알림이 오면 시간 다시 셈)
// TODO: 비교함(CM-09)이 떠 있으면 그 위로 올리기 (useCompareStore가 올라온 뒤 연결)
const TOAST_MS = 2400

// 시안처럼 아래에서 살짝 올라오며 나타난다 (모바일은 탭바 66 위)
const rise = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
`

const Wrap = styled.div`
  position: fixed;
  right: 16px;
  bottom: calc(28px + env(safe-area-inset-bottom));
  left: 16px;
  z-index: 95;
  display: flex;
  justify-content: center;
  pointer-events: none;
  @media (max-width: 899px) {
    bottom: calc(28px + 66px + env(safe-area-inset-bottom));
  }
`

const Bubble = styled.p`
  max-width: calc(100vw - 32px);
  padding: 12px 18px;
  border-radius: var(--r-sm);
  background: var(--ink);
  color: var(--paper);
  font-size: var(--fs-md);
  font-weight: 700;
  text-align: center;
  animation: ${rise} var(--t-pop) ease-out;
`

function Toast() {
  const toast = useUiStore((state) => state.toast)
  const [hiddenId, setHiddenId] = useState(null)

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setHiddenId(toast.id), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const isVisible = toast !== null && hiddenId !== toast.id

  return <Wrap role="status">{isVisible && <Bubble>{toast.message}</Bubble>}</Wrap>
}

export default Toast
