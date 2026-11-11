import { useEffect, useRef } from 'react'
import styled from 'styled-components'
import { IconButton } from '../../styles/common'
import Icon from './Icon'

// UI-15 팝업 창 틀: 뒤 어두운 막 + 창 + 닫기. 열림은 부모가 관리 (isOpen, onClose)
// Esc, 뒤 막 클릭 → onClose / 열리면 창 안 첫 버튼에 커서, 닫히면 누르던 버튼으로 돌아감
// 창 안에서만 Tab 이동. createPortal은 안 쓰고 Layout에서 한 번만 그린다.
// width: 창 폭 (기본 580) / isTop: 다른 팝업 위에 뜨는 창 (상품 상세 창, 로그인 안내 창, z-index 91)
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ $isTop }) => ($isTop ? 91 : 90)};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--scrim);
  @media (max-width: 899px) {
    align-items: flex-end;
    padding: 0;
  }
`

const Dialog = styled.div`
  position: relative;
  width: ${({ $width }) => $width}px;
  max-width: 100%;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  padding: 28px;
  border-radius: var(--r-lg);
  background: var(--paper);
  box-shadow: var(--shadow-pop);
  &:focus {
    outline: none;
  }
  @media (max-width: 899px) {
    width: 100%;
    max-height: 90vh;
    padding: 20px;
    border-radius: var(--r-lg) var(--r-lg) 0 0;
  }
`

const Close = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
`

function Modal({ isOpen, onClose, label, children, width = 580, isTop = false }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined
    const opener = document.activeElement
    const first = dialogRef.current?.querySelector(FOCUSABLE)
    if (first) first.focus()
    else dialogRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    // 창 밖으로 커서가 나가지 않게 처음과 끝을 이어 줌
    const items = dialogRef.current.querySelectorAll(FOCUSABLE)
    if (items.length === 0) {
      event.preventDefault()
      return
    }
    const firstItem = items[0]
    const lastItem = items[items.length - 1]
    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault()
      lastItem.focus()
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault()
      firstItem.focus()
    }
  }

  return (
    <Backdrop
      $isTop={isTop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={handleKeyDown}
    >
      <Dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        $width={width}
      >
        <Close>
          <IconButton aria-label="닫기" onClick={onClose}>
            <Icon name="close" />
          </IconButton>
        </Close>
        {children}
      </Dialog>
    </Backdrop>
  )
}

export default Modal
