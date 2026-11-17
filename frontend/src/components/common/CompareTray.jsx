import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styled, { css, keyframes } from 'styled-components'
import useCompareStore from '../../store/useCompareStore'
import { Button, SlotBadge } from '../../styles/common'
import Icon from '../ui/Icon'

// CM-09 비교함: 비교할 상품 2개를 담아 두는 떠 있는 바 (Layout에서 한 번만 그림). 모양은 시안과 같게: 어두운 바, 가운데
// 비어 있으면, 비교 화면(/compare)에서는 안 보임. [비교하기] → 두 상품을 비교 화면 상품(pair)으로 옮기고 /compare 이동, 비교함은 비움
// 담는 규칙(자금 용도와 상환 방식이 겹치는 상품끼리만, 3번째는 B 바꾸기)은 useCompareStore.addTray가 한다.
// 담기 시작한 화면 밖으로 이동하려다 막히면(Layout) 바를 한 번 흔든다. (useCompareStore의 shakeCount)
const shake = keyframes`
  0%, 100% {
    transform: translateX(-50%);
  }
  25% {
    transform: translateX(calc(-50% - 8px));
  }
  75% {
    transform: translateX(calc(-50% + 8px));
  }
`

const Bar = styled.section`
  position: fixed;
  bottom: calc(24px + env(safe-area-inset-bottom));
  left: 50%;
  z-index: 58;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(640px, calc(100vw - 32px));
  padding: 12px 12px 12px 20px;
  border-radius: var(--r-md);
  background: var(--ink);
  box-shadow: var(--shadow-pop);
  color: var(--paper);
  transform: translateX(-50%);
  ${({ $isShaking }) =>
    $isShaking &&
    css`
      animation: ${shake} 0.4s;
    `}
  @media (max-width: 899px) {
    bottom: calc(66px + 12px + env(safe-area-inset-bottom));
  }
`

const Slots = styled.div`
  display: flex;
  flex: 1;
  gap: 8px;
  min-width: 0;
`

const Slot = styled.span`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: var(--fs-sm);
  font-weight: ${({ $isEmpty }) => ($isEmpty ? 600 : 700)};
  opacity: ${({ $isEmpty }) => ($isEmpty ? 0.6 : 1)};
`

const SlotName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RemoveButton = styled.button.attrs({ type: 'button' })`
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-left: 4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
  &:hover {
    background: color-mix(in srgb, currentColor 15%, transparent);
    opacity: 1;
  }
`

const GoButton = styled(Button)`
  flex: none;
  background: var(--brand-strong);
  color: var(--on-brand);
  &:hover:not(:disabled) {
    background: var(--brand-hover);
  }
`

const ClearButton = styled.button.attrs({ type: 'button' })`
  display: grid;
  flex: none;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.75;
  &:hover {
    background: color-mix(in srgb, currentColor 25%, transparent);
    opacity: 1;
  }
`

const SLOTS = ['A', 'B']

function CompareTray() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const tray = useCompareStore((state) => state.tray)
  const swapSlot = useCompareStore((state) => state.swapSlot)
  const shakeCount = useCompareStore((state) => state.shakeCount)
  const removeTray = useCompareStore((state) => state.removeTray)
  const clearTray = useCompareStore((state) => state.clearTray)
  const goCompare = useCompareStore((state) => state.goCompare)
  const [shakenCount, setShakenCount] = useState(0)

  // 흔들기 신호가 오면 0.4초 동안만 흔든다 (끝나면 shakenCount를 맞춰 다음 신호를 기다림)
  useEffect(() => {
    if (shakeCount === 0) return undefined
    const timer = setTimeout(() => setShakenCount(shakeCount), 400)
    return () => clearTimeout(timer)
  }, [shakeCount])

  if (tray.length === 0 || pathname === '/compare') return null

  const handleCompare = () => {
    goCompare()
    navigate('/compare')
  }

  return (
    <Bar aria-label="비교함" $isShaking={shakeCount !== shakenCount}>
      <Slots>
        {SLOTS.map((label, index) => {
          // 바꿀 칸이 A이면 남긴 상품은 B에, 새로 담는 상품이 A에 놓임
          const item = tray[swapSlot === 'A' ? 1 - index : index]
          return item ? (
            <Slot key={label}>
              <SlotBadge $slot={label} $size={24}>
                {label}
              </SlotBadge>
              <SlotName>{item.productName}</SlotName>
              <RemoveButton aria-label={`${item.productName} 빼기`} onClick={() => removeTray(item.productId)}>
                <Icon name="close" size={13} />
              </RemoveButton>
            </Slot>
          ) : (
            <Slot key={label} $isEmpty>
              <SlotBadge $slot={label} $size={24}>
                {label}
              </SlotBadge>
              <SlotName>상품을 하나 더 담아주세요</SlotName>
            </Slot>
          )
        })}
      </Slots>
      <GoButton $size="sm" disabled={tray.length < 2} onClick={handleCompare}>
        비교하기
      </GoButton>
      <ClearButton aria-label="비교함 비우기" onClick={clearTray}>
        <Icon name="close" size={18} />
      </ClearButton>
    </Bar>
  )
}

export default CompareTray
