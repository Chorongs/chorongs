import styled from 'styled-components'

// UI-08 선택 버튼 묶음: 2~4개 중 하나 고르기. 값은 부모가 관리
// options: [{ value, label }] / isOnPanel: 큰 회색 판 안에서 쓸 때 (묶음 바탕 --mist-2)
const Wrap = styled.div`
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--r-sm);
  background: ${({ $isOnPanel }) => ($isOnPanel ? 'var(--mist-2)' : 'var(--mist)')};
`

const Option = styled.button.attrs({ type: 'button' })`
  height: 32px;
  min-width: 64px;
  padding: 0 16px;
  border: 0;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--cocoa);
  font-size: var(--fs-md);
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: background var(--t-fast);
  &[aria-pressed='true'] {
    background: var(--paper);
    color: var(--ink);
    font-weight: 700;
    box-shadow: var(--shadow-1);
  }
`

function Segmented({ options, value, onChange, isOnPanel = false, label }) {
  return (
    <Wrap role="group" aria-label={label} $isOnPanel={isOnPanel}>
      {options.map((option) => (
        <Option
          key={option.value}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Option>
      ))}
    </Wrap>
  )
}

export default Segmented
