import styled from 'styled-components'

// CH-02 가로 막대: 라벨 + 막대 + 값 한 줄 (상환 방식별 총이자, 신용 항목, 비교표)
// 막대 바탕 없이 오른쪽 끝만 둥글게 (시안과 같게). 현재 선택된 줄은 isActive로 주황 막대 + 굵은 글자
// value / max: 막대 길이 = value ÷ max (max가 0이면 막대 0, 너무 짧아도 2%는 보임) / valueText: 오른쪽에 쓸 글
const Row = styled.div`
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr) 110px;
  gap: 12px;
  align-items: center;
  color: ${({ $isActive }) => ($isActive ? 'var(--ink)' : 'var(--ink-2)')};
  font-size: var(--fs-md);
  font-weight: ${({ $isActive }) => ($isActive ? 800 : 600)};
  @media (max-width: 899px) {
    grid-template-columns: 76px minmax(0, 1fr) 92px;
    gap: 8px;
    font-size: var(--fs-sm);
  }
`

const Track = styled.div`
  height: 12px;
  overflow: hidden;
  border-radius: 0 4px 4px 0;
`

const Fill = styled.span`
  display: block;
  width: ${({ $percent }) => $percent}%;
  height: 100%;
  border-radius: 0 4px 4px 0;
  background: ${({ $isActive }) => ($isActive ? 'var(--viz-2)' : 'var(--viz-other)')};
`

const Value = styled.b`
  font-family: var(--f-num);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  text-align: right;
`

function getPercent(value, max) {
  const number = Number(value)
  const limit = Number(max)
  if (!Number.isFinite(number) || !Number.isFinite(limit) || limit <= 0 || number <= 0) return 0
  return Math.min(100, Math.max(2, (number / limit) * 100))
}

function HBar({ label, value, max, valueText, isActive = false }) {
  return (
    <Row $isActive={isActive}>
      <span>{label}</span>
      <Track aria-hidden="true">
        <Fill $percent={getPercent(value, max)} $isActive={isActive} />
      </Track>
      <Value>{valueText ?? value}</Value>
    </Row>
  )
}

export default HBar
