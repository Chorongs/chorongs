import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

// UI-16 작은 메뉴: 버튼 옆에 뜨는 메뉴. 바깥 클릭, Esc → 닫힘 (열림은 안에서 관리)
// renderTrigger({ isOpen, toggle }): 메뉴를 여는 버튼을 그려서 돌려줌. 이름은 aria-label 로 꼭 붙인다.
// children: 메뉴 내용. 함수로 넘기면 close 를 받음 → {(close) => <button onClick={close}>…</button>}
// 계정 메뉴(z-index 70)에서 사용
const Wrap = styled.div`
  position: relative;
  display: inline-flex;
`

const Menu = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 70;
  min-width: 180px;
  padding: 22px;
  border-radius: var(--r-lg);
  background: var(--paper);
  box-shadow: var(--shadow-pop);
  text-align: left;
`

function Popover({ renderTrigger, children }) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined
    const handleMouseDown = (event) => {
      if (!wrapRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const close = () => setIsOpen(false)
  const toggle = () => setIsOpen((prev) => !prev)

  return (
    <Wrap ref={wrapRef}>
      {renderTrigger({ isOpen, toggle })}
      {isOpen && <Menu>{typeof children === 'function' ? children(close) : children}</Menu>}
    </Wrap>
  )
}

export default Popover
