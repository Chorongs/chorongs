import styled from 'styled-components'

// UI-12 체크박스: 체크 + 라벨 + 보조 설명(선택). 값은 부모가 관리 (checked, onChange)
const Wrap = styled.label`
  display: inline-flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  ${({ $isDisabled }) => $isDisabled && 'opacity: 0.4; cursor: not-allowed;'}
`

// 시안처럼 브라우저 기본 체크칸 19px에 주황 색만 입힘 (키보드, 화면 읽기도 그대로)
const Native = styled.input`
  flex: none;
  width: 19px;
  height: 19px;
  margin: 0;
  accent-color: var(--brand-strong);
`

const Text = styled.span`
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
`

const Title = styled.span`
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 600;
`

const Hint = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

function Checkbox({ checked, onChange, label, description, isDisabled = false }) {
  return (
    <Wrap $isDisabled={isDisabled}>
      <Native
        type="checkbox"
        checked={checked}
        disabled={isDisabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <Text>
        <Title>{label}</Title>
        {description && <Hint>{description}</Hint>}
      </Text>
    </Wrap>
  )
}

export default Checkbox
