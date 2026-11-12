import styled from 'styled-components'

// UI-18 진행 막대: 차오르는 막대 + 숫자
// value: 현재 값 / max: 끝 값 (기본 100) / text: 오른쪽 글자 (예: '3/10', 없으면 퍼센트)
// 0 ~ max 밖 값은 잘라 냄
const Wrap = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const Bar = styled.progress`
  appearance: none;
  flex: 1;
  height: 8px;
  border: 0;
  border-radius: var(--r-pill);
  background: var(--viz-track);
  overflow: hidden;
  &::-webkit-progress-bar {
    background: var(--viz-track);
  }
  &::-webkit-progress-value {
    background: var(--brand-strong);
    border-radius: var(--r-pill);
    transition: width var(--t-pop);
  }
  &::-moz-progress-bar {
    background: var(--brand-strong);
    border-radius: var(--r-pill);
  }
`

const Count = styled.span`
  min-width: 36px;
  color: var(--ink-2);
  font-family: var(--f-num);
  font-size: var(--fs-sm);
  font-weight: 700;
  text-align: right;
`

function ProgressBar({ value, max = 100, text, label }) {
  const safeMax = max > 0 ? max : 100
  const number = Number.isFinite(Number(value)) ? Number(value) : 0
  const clamped = Math.min(Math.max(number, 0), safeMax)
  const percent = Math.round((clamped / safeMax) * 100)

  return (
    <Wrap>
      <Bar value={clamped} max={safeMax} aria-label={label} />
      <Count>{text ?? `${percent}%`}</Count>
    </Wrap>
  )
}

export default ProgressBar
