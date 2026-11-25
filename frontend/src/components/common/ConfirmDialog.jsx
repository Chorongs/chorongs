import styled from 'styled-components'
import { Button, DialogActions, DialogText } from '../../styles/common'
import Modal from '../ui/Modal'

// 확인 창 공통 틀 (MY 지우기, 진단 리포트 삭제, 로그아웃, 회원 탈퇴, 관리자 승인, 반영, 되돌리기 등이 같이 씀)
// 위 글 title / 그 아래 내용 children (있을 때) / 오른쪽 끝 버튼 줄 [취소] [confirmLabel]
// titleSize: 'md' 질문 한 줄 (기본) / 'lg' 큰 제목 (내용이 있는 창)
// cancelLabel을 null로 넘기면 [취소] 없이 확인 버튼 하나 (끝남 안내 창)
// isConfirmDisabled: 확인 버튼 잠금 (누르는 중 E5, 체크 전 등) / [취소], Esc, 바깥 누르기는 onClose
// width: 창 폭 (기본 380) / showClose: 위쪽 닫기 줄 (기본 안 그림)
const Title = styled.h2`
  margin-bottom: 16px;
  font-size: var(--fs-h3);
  font-weight: 800;
`

function ConfirmDialog({
  isOpen,
  onClose,
  label,
  title,
  titleSize = 'md',
  children,
  confirmLabel,
  onConfirm,
  isConfirmDisabled = false,
  cancelLabel = '취소',
  width = 380,
  showClose = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} label={label} width={width} showClose={showClose}>
      {titleSize === 'lg' ? <Title>{title}</Title> : <DialogText>{title}</DialogText>}
      {children}
      <DialogActions>
        {cancelLabel !== null && (
          <Button $variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
        )}
        <Button onClick={onConfirm} disabled={isConfirmDisabled}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Modal>
  )
}

export default ConfirmDialog
