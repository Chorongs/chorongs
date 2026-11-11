import styled from 'styled-components'
import Icon from './Icon'

// UI-12 체크박스: 체크 + 라벨 + 보조 설명(선택). 값은 부모가 관리 (checked, onChange)
const Wrap = styled.label`
  position: relative;
  display: inline-flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
`

// 진짜 체크칸은 화면에서 숨기고 키보드, 화면 읽기는 그대로 둠
const Native = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`

const Mark = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  border: 1px solid var(--line-2);
  border-radius: var(--r-xs);
  background: var(--paper);
  color: var(--on-brand);
  transition: background var(--t-fast), border-color var(--t-fast);
  ${Native}:checked + & {
    border-color: var(--brand-strong);
    background: var(--brand-strong);
  }
  ${Native}:focus-visible + & {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  ${Native}:disabled + & {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

const Text = styled.span`
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
`

const Title = styled.span`
  color: var(--ink);
  font-size: var(--fs-base);
  font-weight: 600;
`

const Hint = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

function Checkbox({ checked, onChange, label, description, isDisabled = false }) {
  return (
    <Wrap>
      <Native
        type="checkbox"
        checked={checked}
        disabled={isDisabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <Mark>{checked && <Icon name="check" size={16} />}</Mark>
      <Text>
        <Title>{label}</Title>
        {description && <Hint>{description}</Hint>}
      </Text>
    </Wrap>
  )
}

export default Checkbox
