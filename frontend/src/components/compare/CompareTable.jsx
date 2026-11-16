import styled from 'styled-components'
import { FEATURE_LABEL } from '../../constants/options'
import { SlotBadge } from '../../styles/common'
import { formatMoney, formatPrepayFee, formatRate } from '../../utils/format'
import Icon from '../ui/Icon'

// CP-05 비교표: 항목별 A/B 비교. 시안과 같게 가운데 항목 이름, 왼쪽 A(주황 막대), 오른쪽 B(파랑 막대)로 마주 봄
// 유리한 쪽에 '유리' 딱지 + 진한 가로 막대. 월 상환, 총이자는 금리 중간값 + 원리금균등으로 계산한 값 (utils/loanMath.js, 부모가 계산해서 resultA, resultB로 줌)
// 값 없음 → '정보 없음' (유리 판정에서 뺌) / 월 상환, 총이자를 못 구하면 '계산 불가' / 한도가 금액이 아닌 상품은 유형 글 (tags의 AMOUNT)
const Legend = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0 10px;
  border-bottom: 2px solid var(--ink);
  font-size: var(--fs-md);
  font-weight: 800;
  & > span {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
`

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 148px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px 12px;
    padding: 14px 0;
  }
  @media (max-width: 420px) {
    gap: 6px 8px;
  }
`

const Label = styled.div`
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 800;
  text-align: center;
  small {
    display: block;
    color: var(--muted);
    font-size: var(--fs-xs);
    font-weight: 500;
  }
  @media (max-width: 899px) {
    display: flex;
    grid-column: 1 / -1;
    grid-row: 1;
    align-items: baseline;
    gap: 8px;
    text-align: left;
    small {
      display: inline;
    }
  }
`

const Side = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  ${({ $side }) => ($side === 'l' ? 'align-items: flex-end; text-align: right;' : '')}
  @media (max-width: 899px) {
    ${({ $side }) => ($side === 'l' ? 'align-items: flex-start; text-align: left;' : '')}
  }
`

const Value = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-direction: ${({ $side }) => ($side === 'l' ? 'row-reverse' : 'row')};
  color: ${({ $isNa, $isText }) => ($isNa ? 'var(--muted)' : $isText ? 'var(--ink-2)' : 'inherit')};
  font-family: ${({ $isNa, $isText }) => ($isNa || $isText ? 'var(--f-ui)' : 'var(--f-num)')};
  font-size: ${({ $isNa, $isText }) => ($isNa || $isText ? 'var(--fs-md)' : 'var(--fs-xl)')};
  font-weight: ${({ $isNa, $isText }) => ($isNa ? 700 : $isText ? 600 : 800)};
  font-variant-numeric: tabular-nums;
  line-height: ${({ $isText }) => ($isText ? 1.5 : 'inherit')};
  @media (max-width: 899px) {
    flex-direction: row;
    font-size: ${({ $isNa, $isText }) => ($isNa || $isText ? 'var(--fs-md)' : 'var(--fs-lg)')};
  }
  @media (max-width: 420px) {
    font-size: ${({ $isNa, $isText }) => ($isNa || $isText ? 'var(--fs-md)' : 'var(--fs-base)')};
  }
`

const Win = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 7px;
  border-radius: var(--r-xs);
  background: var(--good-soft);
  color: var(--good);
  font-family: var(--f-ui);
  font-size: var(--fs-2xs);
  font-weight: 800;
`

const Track = styled.div`
  display: flex;
  justify-content: ${({ $side }) => ($side === 'l' ? 'flex-end' : 'flex-start')};
  width: 100%;
  height: 8px;
  overflow: hidden;
  border-radius: var(--r-xs);
  background: var(--viz-track);
  @media (max-width: 899px) {
    justify-content: flex-start;
  }
`

const Fill = styled.span`
  display: block;
  width: ${({ $percent }) => $percent}%;
  height: 100%;
  border-radius: var(--r-xs);
  background: ${({ $side }) => ($side === 'l' ? 'var(--viz-2)' : 'var(--viz-1)')};
  opacity: ${({ $isWin }) => ($isWin ? 1 : 0.38)};
`

function getTagText(product, tagType) {
  const values = (product.tags ?? []).filter((tag) => tag.tagType === tagType).map((tag) => tag.tagValue)
  return values.length > 0 ? values.join(', ') : '정보 없음'
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

// 한도가 금액이 아니면 유형 글 (tags의 AMOUNT)
function getLimitNa(product) {
  const amountTag = (product.tags ?? []).find((tag) => tag.tagType === 'AMOUNT')
  return amountTag?.tagValue ?? '정보 없음'
}

// 숫자 항목: 한쪽 칸의 값 (num이 null이면 na 글)
function numberCell(num, format, na) {
  return isNumber(num) ? { num, text: format(num) } : { num: null, text: na }
}

function buildRows(productA, productB, resultA, resultB, amountMan, months) {
  const rate = (value) => `${formatRate(value)}%`
  return [
    {
      label: '최저 금리',
      sub: '낮을수록 유리',
      key: 'rateMin',
      a: numberCell(productA.rateMin, rate, '정보 없음'),
      b: numberCell(productB.rateMin, rate, '정보 없음'),
    },
    {
      label: '최고 금리',
      sub: '낮을수록 유리',
      key: 'rateMax',
      a: numberCell(productA.rateMax, rate, '정보 없음'),
      b: numberCell(productB.rateMax, rate, '정보 없음'),
    },
    {
      label: '최대 한도',
      sub: '높을수록 유리',
      key: 'limit',
      a: numberCell(productA.limitAmount, (value) => formatMoney(value), getLimitNa(productA)),
      b: numberCell(productB.limitAmount, (value) => formatMoney(value), getLimitNa(productB)),
    },
    {
      label: '최대 기간',
      sub: '길수록 여유',
      key: 'term',
      a: numberCell(productA.termMax > 0 ? productA.termMax : null, (value) => `${value}개월`, '정보 없음'),
      b: numberCell(productB.termMax > 0 ? productB.termMax : null, (value) => `${value}개월`, '정보 없음'),
    },
    {
      label: '중도상환수수료',
      sub: '낮을수록 유리',
      key: 'prepay',
      a: numberCell(productA.prepayFeeMax, formatPrepayFee, '기관 문의'),
      b: numberCell(productB.prepayFeeMax, formatPrepayFee, '기관 문의'),
    },
    {
      label: '신용점수 기준',
      sub: '낮을수록 쉬움',
      key: 'credit',
      a: numberCell(productA.creditMin, (value) => `${value}점`, '정보 없음'),
      b: numberCell(productB.creditMin, (value) => `${value}점`, '정보 없음'),
    },
    {
      label: '예상 월 상환액',
      sub: `${months}개월 기준`,
      key: 'monthly',
      a: numberCell(resultA.monthly, (value) => formatMoney(value, '원'), '계산 불가'),
      b: numberCell(resultB.monthly, (value) => formatMoney(value, '원'), '계산 불가'),
    },
    {
      label: '총이자',
      sub: `${formatMoney(amountMan)} 기준`,
      key: 'totalInterest',
      a: numberCell(resultA.totalInterest, (value) => formatMoney(value, '원'), '계산 불가'),
      b: numberCell(resultB.totalInterest, (value) => formatMoney(value, '원'), '계산 불가'),
    },
  ]
}

function NumberSide({ side, cell, isWin, max }) {
  const hasNum = cell.num !== null
  const percent = hasNum ? Math.max(3, (cell.num / max) * 100) : 0
  return (
    <Side $side={side}>
      <Value $side={side} $isNa={!hasNum}>
        {cell.text}
        {isWin && (
          <Win>
            <Icon name="check" size={12} />
            유리
          </Win>
        )}
      </Value>
      <Track $side={side} aria-hidden="true">
        {hasNum && <Fill $side={side} $percent={percent} $isWin={isWin} />}
      </Track>
    </Side>
  )
}

function TextRow({ label, textA, textB }) {
  return (
    <Row>
      <Side $side="l">
        <Value $side="l" $isText>
          {textA}
        </Value>
      </Side>
      <Label>{label}</Label>
      <Side $side="r">
        <Value $side="r" $isText>
          {textB}
        </Value>
      </Side>
    </Row>
  )
}

function getFeatureText(product) {
  const features = (product.features ?? []).map((code) => FEATURE_LABEL[code] ?? code)
  return features.length > 0 ? features.join(', ') : '-'
}

function CompareTable({ productA, productB, resultA, resultB, winners, amountMan, months }) {
  const rows = buildRows(productA, productB, resultA, resultB, amountMan, months)

  return (
    <div aria-label="비교표">
      <Legend>
        <span>
          <SlotBadge $slot="A" $size={22}>
            A
          </SlotBadge>
          {productA.productName}
        </span>
        <span>
          {productB.productName}
          <SlotBadge $slot="B" $size={22}>
            B
          </SlotBadge>
        </span>
      </Legend>
      {rows.map((row) => {
        const max = Math.max(row.a.num ?? 0, row.b.num ?? 0) || 1
        return (
          <Row key={row.label}>
            <NumberSide side="l" cell={row.a} isWin={winners[row.key] === 'A'} max={max} />
            <Label>
              {row.label}
              <small>{row.sub}</small>
            </Label>
            <NumberSide side="r" cell={row.b} isWin={winners[row.key] === 'B'} max={max} />
          </Row>
        )
      })}
      <TextRow label="상환 방식" textA={getTagText(productA, 'REPAY')} textB={getTagText(productB, 'REPAY')} />
      <TextRow label="신청 대상" textA={getTagText(productA, 'TARGET')} textB={getTagText(productB, 'TARGET')} />
      <TextRow label="상품 특징" textA={getFeatureText(productA)} textB={getFeatureText(productB)} />
    </div>
  )
}

export default CompareTable
