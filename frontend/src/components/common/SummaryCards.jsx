import styled from 'styled-components'

// CM-11 결과 요약 3칸: 첫 칸은 위에 한 줄로 크게(40, 주황 강조), 나머지 두 칸은 그 아래에 나란히 (계산기, 소비 습관)
// items: [{ label, value, sub, tone }] 3개 / value는 글자나 MoneyText 같은 요소 / sub: 아래 작은 글
// tone: 'hl'(주황, 첫 칸 기본) / 'good' / 'warn' / 'bad' / 생략하면 기본 글자색
const TONE_COLOR = {
  hl: 'var(--brand-text)',
  good: 'var(--good)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line);
`

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding-right: 16px;
  &:first-child {
    grid-column: 1 / -1;
    margin-bottom: 16px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--line);
  }
  &:nth-child(3) {
    padding-left: 20px;
    border-left: 1px solid var(--line);
  }
  &:only-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: 0;
  }
`

const Label = styled.small`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const Value = styled.b`
  color: ${({ $tone }) => TONE_COLOR[$tone] || 'inherit'};
  font-family: var(--f-num);
  font-size: ${({ $isFirst }) => ($isFirst ? 'var(--fs-d2)' : 'var(--fs-h2)')};
  font-weight: 900;
  letter-spacing: -0.015em;
  line-height: 1.25;
  white-space: nowrap;
`

const Sub = styled.em`
  color: var(--muted);
  font-size: var(--fs-xs);
  font-style: normal;
  font-weight: 600;
`

function SummaryCards({ items = [] }) {
  return (
    <Grid>
      {items.map((item, index) => (
        <Cell key={item.label}>
          <Label>{item.label}</Label>
          <Value $isFirst={index === 0} $tone={item.tone ?? (index === 0 ? 'hl' : undefined)}>
            {item.value}
          </Value>
          {item.sub && <Sub>{item.sub}</Sub>}
        </Cell>
      ))}
    </Grid>
  )
}

export default SummaryCards
