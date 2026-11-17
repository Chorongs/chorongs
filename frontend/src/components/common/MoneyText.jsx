import styled from 'styled-components'
import { formatMoney } from '../../utils/format'

// CM-12 금액 글자: 숫자 + 작은 단위 (만원, 억, 원). 숫자 글꼴 Nunito, 숫자 크기는 쓰는 곳의 글자 크기를 따른다.
// value: 금액 / unit: '만원'(기본, 만원 단위 값) 또는 '원'(원 단위 값) / 값이 없거나 숫자가 아니면 '-'
// weight: 숫자 굵기 (기본 800, 요약 숫자는 900)
// unitSize: 단위 크기 'sm'(기본, 13px) / 'base'(15px) / 'xs'(12px)
// unitTone: 단위 색 'inherit'(기본, 숫자와 같은 색) / 'muted'(설명 글자색) / 'soft'(숫자색을 옅게)
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

function MoneyText({ value, unit = '만원', weight = 800, unitSize = 'sm', unitTone = 'inherit' }) {
  const text = formatMoney(value, unit)
  if (text === '-') return <Num $weight={weight}>-</Num>

  // '1억 2,000만원' → ['1', '억', ' 2,000', '만원', ''] (홀수 칸이 단위)
  const parts = text.split(/(억|만원|원)/)
  return (
    <Num $weight={weight}>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <Unit key={index} $size={unitSize} $tone={unitTone}>
            {part}
          </Unit>
        ) : (
          part
        ),
      )}
    </Num>
  )
}

export default MoneyText
