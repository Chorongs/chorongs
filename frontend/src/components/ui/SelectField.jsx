import { useId } from 'react'
import styled from 'styled-components'
import Icon from './Icon'

// UI-11 드롭다운: 기본형 / 알약형(isPill, 랭킹 필터). 값은 부모가 관리
// options: [{ value, label }] / label: 기본형은 위에 글자로 보임, 알약형은 화면 읽기용 이름
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Label = styled.label`
  color: var(--ink-2);
  font-size: var(--fs-sm);
  font-weight: 600;
`

const Box = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  color: var(--cocoa);
`

const Select = styled.select`
  appearance: none;
  width: 100%;
  height: ${({ $isPill }) => ($isPill ? '38px' : '52px')};
  padding: ${({ $isPill }) => ($isPill ? '0 36px 0 16px' : '0 40px 0 16px')};
  border: 1px solid var(--line-2);
  border-radius: ${({ $isPill }) => ($isPill ? 'var(--r-pill)' : 'var(--r-sm)')};
  background: var(--paper);
  color: var(--ink);
  font-size: ${({ $isPill }) => ($isPill ? 'var(--fs-md)' : 'var(--fs-lg)')};
  font-weight: ${({ $isPill }) => ($isPill ? 600 : 400)};
  text-align: left;
  cursor: pointer;
  @media (max-width: 899px) {
    height: ${({ $isPill }) => ($isPill ? '38px' : '48px')};
  }
`

const Arrow = styled.span`
  position: absolute;
  right: 14px;
  display: inline-flex;
  pointer-events: none;
`

function SelectField({ label, value, onChange, options, placeholder, isPill = false }) {
  const selectId = useId()

  return (
    <Wrap>
      {label && !isPill && <Label htmlFor={selectId}>{label}</Label>}
      <Box>
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
        <Arrow>
          <Icon name="chevron_down" size={16} />
        </Arrow>
      </Box>
    </Wrap>
  )
}

export default SelectField
