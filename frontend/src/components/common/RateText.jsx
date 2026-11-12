import styled from 'styled-components'
import { formatRate } from '../../utils/format'

// CM-12 금리 글자: 숫자 + 작은 %. 소수 둘째 자리 (2.00%), 숫자 글꼴 Nunito, 숫자 크기는 쓰는 곳의 글자 크기를 따른다.
// value: 금리 하나 / min, max: 금리 범위 (앞 숫자만 크게, '4.50 ~9.80%'처럼 뒤는 작게) / 값이 없거나 숫자가 아니면 '-'
// hasFixedLabel: 범위의 두 값이 같을 때 '% 고정'으로 표시 (상품 목록, 상세의 대표 금리)
// weight, unitSize, unitTone: MoneyText와 같음
const UNIT_SIZE = { xs: 'var(--fs-xs)', sm: 'var(--fs-sm)', base: 'var(--fs-base)' }
const UNIT_WEIGHT = { xs: 800, sm: 700, base: 800 }

const Num = styled.span`
  font-family: var(--f-num);
  font-variant-numeric: tabular-nums;
  font-weight: ${({ $weight }) => $weight};
`

const Unit = styled.small`
  margin-left: 2px;
  color: ${({ $tone }) => ($tone === 'muted' ? 'var(--cocoa)' : 'inherit')};
  font-family: var(--f-ui);
  font-size: ${({ $size }) => UNIT_SIZE[$size]};
  font-weight: ${({ $size }) => UNIT_WEIGHT[$size]};
  opacity: ${({ $tone }) => ($tone === 'soft' ? 0.8 : 1)};
`

// 크게 쓸 앞 숫자(main)와 작게 쓸 뒤 글자(tail). 표시할 값이 없으면 null
function getRateParts({ value, min, max, hasFixedLabel }) {
  if (value !== undefined) {
    const text = formatRate(value)
    return text === '-' ? null : { main: text, tail: '%' }
  }
  const low = formatRate(min)
  const high = formatRate(max)
  if (low === '-' && high === '-') return null
  if (low === '-') return { main: high, tail: '%' }
  if (high === '-') return { main: low, tail: '%' }
  if (low === high) return { main: low, tail: hasFixedLabel ? '% 고정' : '%' }
  return { main: low, tail: `~${high}%` }
}

function RateText({ value, min, max, hasFixedLabel = false, weight = 800, unitSize = 'sm', unitTone = 'inherit' }) {
  const parts = getRateParts({ value, min, max, hasFixedLabel })
  if (!parts) return <Num $weight={weight}>-</Num>

  return (
    <Num $weight={weight}>
      {parts.main}
      <Unit $size={unitSize} $tone={unitTone}>
        {parts.tail}
      </Unit>
    </Num>
  )
}

export default RateText
