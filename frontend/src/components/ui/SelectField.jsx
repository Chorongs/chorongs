import { useId } from 'react'
import styled from 'styled-components'

// UI-11 드롭다운: 기본형 / 알약형(isPill, 랭킹 필터). 값은 부모가 관리
// options: [{ value, label }] / label: 기본형은 위에 글자로 보임, 알약형은 화면 읽기용 이름
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Label = styled.label`
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
`

// 화살표는 시안처럼 가장자리 두 변을 돌린 작은 꺾쇠
const Box = styled.div`
  position: relative;
  min-width: 0;
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    right: ${({ $isPill }) => ($isPill ? '15px' : '17px')};
    width: ${({ $isPill }) => ($isPill ? '7px' : '8px')};
    height: ${({ $isPill }) => ($isPill ? '7px' : '8px')};
    border-right: 2px solid var(--cocoa);
    border-bottom: 2px solid var(--cocoa);
    pointer-events: none;
    transform: translateY(-70%) rotate(45deg);
  }
`

const Select = styled.select`
  appearance: none;
  width: 100%;
  height: ${({ $isPill }) => ($isPill ? '40px' : '52px')};
  padding: ${({ $isPill }) => ($isPill ? '0 36px 0 16px' : '0 42px 0 14px')};
  border: 1px solid var(--line-2);
  border-radius: ${({ $isPill }) => ($isPill ? 'var(--r-pill)' : 'var(--r-sm)')};
  background: var(--paper);
  color: var(--ink);
  font-size: ${({ $isPill }) => ($isPill ? 'var(--fs-md)' : 'var(--fs-base)')};
  font-weight: ${({ $isPill }) => ($isPill ? 700 : 600)};
  text-align: left;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
  &:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px var(--brand-soft);
    outline: none;
  }
  @media (max-width: 899px) {
    height: ${({ $isPill }) => ($isPill ? '40px' : '48px')};
  }
`

function SelectField({ label, value, onChange, options, placeholder, isPill = false }) {
  const selectId = useId()

  return (
    <Wrap>
      {label && !isPill && <Label htmlFor={selectId}>{label}</Label>}
      <Box $isPill={isPill}>
        <Select
          id={selectId}
          $isPill={isPill}
          value={value}
          aria-label={isPill ? label : undefined}
          onChange={(event) => onChange(event.target.value)}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Box>
    </Wrap>
  )
}

export default SelectField
