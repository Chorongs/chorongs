import styled from 'styled-components'
import useUiStore from '../../store/useUiStore'
import Icon from '../ui/Icon'

// LY-06 도우미 버튼: 누르면 상시 도우미 열기/닫기. aria-expanded를 실제 열림 상태와 맞춤
// 시안처럼 연회색 알약 버튼 (열리면 연주황). 900px 미만에서는 아이콘만 보인다.
const Toggle = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 14px 0 12px;
  border-radius: var(--r-pill);
  background: var(--mist);
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
  transition: background var(--t-fast), color var(--t-fast);
  &:hover {
    background: var(--mist-2);
    color: var(--ink);
  }
  &[aria-expanded='true'] {
    background: var(--brand-soft);
    color: var(--brand-text);
  }
  @media (max-width: 899px) {
    justify-content: center;
    width: 40px;
    padding: 0;
    background: transparent;
    &[aria-expanded='true'] {
      background: var(--brand-soft);
    }
  }
`

const Label = styled.span`
  @media (max-width: 899px) {
    display: none;
  }
`

function HelperToggle() {
  const helperOpen = useUiStore((state) => state.helperOpen)
  const toggleHelper = useUiStore((state) => state.toggleHelper)

  return (
    <Toggle aria-expanded={helperOpen} aria-label="도우미" onClick={toggleHelper}>
      <Icon name="help" />
      <Label>도우미</Label>
    </Toggle>
  )
}

export default HelperToggle
