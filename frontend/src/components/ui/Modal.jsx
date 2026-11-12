import { useEffect, useRef } from 'react'
import styled from 'styled-components'
import { IconButton } from '../../styles/common'
import Icon from './Icon'

// UI-15 팝업 창 틀: 뒤 어두운 막 + 창 + 닫기. 열림은 부모가 관리 (isOpen, onClose)
// Esc, 뒤 막 클릭 → onClose / 열리면 창 안 첫 버튼에 커서, 닫히면 누르던 버튼으로 돌아감
// 창 안에서만 Tab 이동. createPortal은 안 쓰고 Layout에서 한 번만 그린다.
// width: 창 폭 (기본 580) / isTop: 다른 팝업 위에 뜨는 창 (상품 상세 창, 로그인 안내 창, z-index 91)
// isTallOnMobile: 모바일(900px 미만)에서 내용이 짧아도 높이 90%로 올라오는 창 (상품 상세 창)
// isFull: 화면 가득 채우는 창 (모바일 전체 메뉴) / showClose: false면 위쪽 닫기 줄을 안 그림 (제목 줄에 닫기 버튼을 직접 두는 창)
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// isFull: 화면 가득 채우는 창 (모바일 전체 메뉴, z-index 85)
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${({ $isTop, $isFull }) => ($isTop ? 91 : $isFull ? 85 : 90)};
  display: flex;
  align-items: ${({ $isFull }) => ($isFull ? 'stretch' : 'center')};
  justify-content: center;
  padding: ${({ $isFull }) => ($isFull ? 0 : '16px')};
  background: ${({ $isFull }) => ($isFull ? 'var(--paper)' : 'var(--scrim)')};
  @media (max-width: 899px) {
    align-items: ${({ $isFull }) => ($isFull ? 'stretch' : 'flex-end')};
    padding: 0;
  }
`

const Dialog = styled.div`
  position: relative;
  width: ${({ $width, $isFull }) => ($isFull ? '100%' : `${$width}px`)};
  max-width: 100%;
  height: ${({ $isFull }) => ($isFull ? '100%' : 'auto')};
  max-height: ${({ $isFull }) => ($isFull ? 'none' : 'calc(100vh - 48px)')};
  overflow-y: auto;
  padding: ${({ $isFull }) =>
    $isFull
      ? 'calc(12px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))'
      : '28px'};
  border-radius: ${({ $isFull }) => ($isFull ? 0 : 'var(--r-lg)')};
  background: var(--paper);
  box-shadow: ${({ $isFull }) => ($isFull ? 'none' : 'var(--shadow-pop)')};
  &:focus {
    outline: none;
  }
  /* 스크롤바는 창 안쪽에 얇게 (모서리와 위아래 여백 안으로), 화살표 없음 */
  &::-webkit-scrollbar {
    width: 14px;
    height: 14px;
  }
  &::-webkit-scrollbar-track {
    margin: 20px 0;
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    border: 5px solid transparent;
    border-radius: 999px;
    background: var(--line-2);
    background-clip: padding-box;
  }
  &::-webkit-scrollbar-thumb:hover {
    background-color: var(--muted);
  }
  &::-webkit-scrollbar-button {
    display: none;
  }
  @supports not selector(::-webkit-scrollbar) {
    scrollbar-width: thin;
    scrollbar-color: var(--line-2) transparent;
  }
  @media (max-width: 899px) {
    width: 100%;
    max-height: ${({ $isFull }) => ($isFull ? 'none' : '90vh')};
    height: ${({ $isFull, $isTallOnMobile }) => ($isFull ? '100%' : $isTallOnMobile ? '90vh' : 'auto')};
    padding: ${({ $isFull }) =>
      $isFull
        ? 'calc(12px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))'
        : '24px max(20px, env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))'};
    border-radius: ${({ $isFull }) => ($isFull ? 0 : 'var(--r-lg) var(--r-lg) 0 0')};
  }
`

const Close = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
`

// showClose: false면 위쪽 닫기 줄을 안 그림 (제목 줄에 닫기 버튼을 직접 두는 창, 예: 상품 상세 창)
function Modal({
  isOpen,
  onClose,
  label,
  children,
  width = 580,
  isTop = false,
  showClose = true,
  isFull = false,
  isTallOnMobile = false,
}) {
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
      $isFull={isFull}
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
        $isFull={isFull}
        $isTallOnMobile={isTallOnMobile}
      >
        {showClose && (
          <Close>
            <IconButton aria-label="닫기" onClick={onClose}>
              <Icon name="close" />
            </IconButton>
          </Close>
        )}
        {children}
      </Dialog>
    </Backdrop>
  )
}

export default Modal
