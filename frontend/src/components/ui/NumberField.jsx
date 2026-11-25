import { useId, useState } from 'react'
import styled from 'styled-components'
import { Chip, InlineError } from '../../styles/common'
import { formatWonReadable } from '../../utils/format'

// UI-09 숫자 입력칸: 라벨 + 숫자 + 단위. 값은 부모가 관리
// value: 숫자 또는 '' (빈 값) / onChange(숫자 또는 '')
// quickValues: 빠른 금액 칩 [{ label: '300만', value: 3000000 }]
// showReadable: 원 단위 금액 칸에서 입력칸 바로 아래 오른쪽 끝에 읽기 쉬운 금액 글을 보임 (12345678 → '1,234만 5,678원', 1만원 이상일 때만)
// isLabelInside: 이름을 입력칸 위가 아니라 칸 안 왼쪽 회색 칸에 보임 (계산기 모양, 가안 .inp .lab) / isCompact: 칸 높이 48 (상자 안 입력칸)
// error: 서버가 400으로 돌려준 문구
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

const Box = styled.div`
  display: flex;
  align-items: stretch;
  height: ${({ $isCompact }) => ($isCompact ? '48px' : '52px')};
  overflow: hidden;
  border: 1px solid ${({ $hasError }) => ($hasError ? 'var(--bad)' : 'var(--line-2)')};
  border-radius: var(--r-sm);
  background: var(--paper);
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
  &:focus-within {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px var(--brand-soft);
  }
  @media (max-width: 899px) {
    height: 48px;
  }
`

// 칸 안 왼쪽 이름 (isLabelInside)
const InnerLabel = styled.label`
  display: flex;
  flex: none;
  align-items: center;
  min-width: 96px;
  padding: 0 14px;
  border-right: 1px solid var(--line);
  background: var(--mist);
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
  white-space: nowrap;
  @media (max-width: 420px) {
    min-width: 84px;
    padding: 0 11px;
    font-size: var(--fs-sm);
  }
`

const Input = styled.input`
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: 0 14px;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ink);
  font-family: var(--f-num);
  font-size: var(--fs-xl);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: left;
`

const Unit = styled.span`
  display: flex;
  align-items: center;
  padding: 0 15px 0 4px;
  color: var(--cocoa);
  font-size: var(--fs-md);
  font-weight: 700;
  white-space: nowrap;
`

const Quick = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

// 입력칸 바로 아래 오른쪽 끝의 읽기 쉬운 금액 글 (오류 문구와 달리 색 없이 보조 글자)
const Readable = styled.small`
  align-self: flex-end;
  color: var(--cocoa);
  font-family: var(--f-num);
  font-size: var(--fs-sm);
  font-weight: 600;
`

const toText = (value) => (value === '' || value == null ? '' : String(value))

// 입력 글자 → 숫자. 아직 숫자가 안 된 글자('', '-', '.')는 '' (빈 값)
const toNumber = (text) => (/\d/.test(text) ? Number(text) : '')

// 숫자 아닌 글자 무시, 소수점 자릿수 제한, 음수는 min이 0보다 작을 때만
const cleanText = (raw, decimals, allowNegative) => {
  const isNegative = allowNegative && raw.trim().startsWith('-')
  let text = raw.replace(/[^\d.]/g, '')
  if (decimals <= 0) {
    text = text.replace(/\./g, '')
  } else {
    const dot = text.indexOf('.')
    if (dot >= 0) {
      text = text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, '').slice(0, decimals)
    }
  }
  text = text.replace(/^0+(?=\d)/, '')
  return (isNegative ? '-' : '') + text
}

// 화면용: 정수 부분에 천 단위 쉼표
const addComma = (text) => {
  const [integer, decimal] = text.split('.')
  const sign = integer.startsWith('-') ? '-' : ''
  const grouped = integer.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return sign + grouped + (decimal === undefined ? '' : `.${decimal}`)
}

function NumberField({
  label,
  value,
  onChange,
  unit,
  min = 0,
  max,
  decimals = 0,
  hasComma = false,
  quickValues = [],
  isRequired = false,
  isLabelInside = false,
  isCompact = false,
  showReadable = false,
  placeholder,
  error,
}) {
  const inputId = useId()
  const errorId = useId()
  const [text, setText] = useState(toText(value))
  const [prevValue, setPrevValue] = useState(value)
  const [isTouched, setIsTouched] = useState(false)

  // 부모가 값을 바꾸면 (예: 초기화) 입력 글자도 맞춤
  if (value !== prevValue) {
    setPrevValue(value)
    if ((value ?? '') !== toNumber(text)) setText(toText(value))
  }

  const applyText = (nextText) => {
    setText(nextText)
    onChange(toNumber(nextText))
  }

  const handleChange = (event) => {
    applyText(cleanText(event.target.value, decimals, min < 0))
  }

  const handleQuick = (quickValue) => {
    setIsTouched(true)
    applyText(String(quickValue))
  }

  // 범위 검사 (E2): 빈 값, 최소, 최대
  let localError = ''
  const number = toNumber(text)
  if (number === '') {
    if (isRequired) localError = '값을 입력해 주세요'
  } else if (number < min) {
    localError = `${min.toLocaleString('ko-KR')}${unit ?? ''} 이상 입력해 주세요`
  } else if (max !== undefined && number > max) {
    localError = `${max.toLocaleString('ko-KR')}${unit ?? ''} 이하로 입력해 주세요`
  }
  const message = error || (isTouched ? localError : '')
  const isReadableShown = showReadable && number !== '' && number >= 10000

  return (
    <Wrap>
      {label && !isLabelInside && <Label htmlFor={inputId}>{label}</Label>}
      <Box $hasError={Boolean(message)} $isCompact={isCompact}>
        {label && isLabelInside && <InnerLabel htmlFor={inputId}>{label}</InnerLabel>}
        <Input
          id={inputId}
          type="text"
          inputMode={decimals > 0 ? 'decimal' : 'numeric'}
          autoComplete="off"
          value={hasComma ? addComma(text) : text}
          placeholder={placeholder}
          aria-invalid={Boolean(message)}
          aria-describedby={message ? errorId : undefined}
          onChange={handleChange}
          onBlur={() => setIsTouched(true)}
        />
        {unit && <Unit>{unit}</Unit>}
      </Box>
      {isReadableShown && <Readable>{formatWonReadable(number)}</Readable>}
      {quickValues.length > 0 && (
        <Quick>
          {quickValues.map((quick) => (
            <Chip
              key={quick.value}
              $size="sm"
              aria-pressed={number === quick.value}
              onClick={() => handleQuick(quick.value)}
            >
              {quick.label}
            </Chip>
          ))}
        </Quick>
      )}
      <InlineError id={errorId}>{message}</InlineError>
    </Wrap>
  )
}

export default NumberField
