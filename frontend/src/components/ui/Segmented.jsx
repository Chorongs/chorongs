import styled from 'styled-components'

// UI-08 선택 버튼 묶음: 2~4개 중 하나 고르기. 값은 부모가 관리
// options: [{ value, label }] / isOnPanel: 큰 회색 판 안에서 쓸 때 (묶음 바탕 --mist-2)
const Wrap = styled.div`
  display: inline-flex;
  gap: 2px;
  max-width: 100%;
  padding: 4px;
  overflow-x: auto;
  border-radius: var(--r-sm);
  background: ${({ $isOnPanel }) => ($isOnPanel ? 'var(--mist-2)' : 'var(--mist)')};
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`

const Option = styled.button.attrs({ type: 'button' })`
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--cocoa);
  font-size: var(--fs-md);
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
  &:hover {
    color: var(--ink);
  }
  &[aria-pressed='true'] {
    background: var(--paper);
    color: var(--ink);
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
