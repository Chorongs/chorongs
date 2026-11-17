import styled from 'styled-components'

// CM-20 1~3위 메달: 리본 + 동그라미 + 숫자 (금, 은, 동). rank가 1~3이 아니면 그리지 않는다.
// size: 한 변 길이 (기본 30, 맞춤 추천 딱지에서는 26)
// (1~3위 카드의 주황 테두리는 쓰는 화면에서 입힌다.)
const MEDAL_COLOR = { 1: 'var(--gold)', 2: 'var(--silver)', 3: 'var(--bronze)' }

const Svg = styled.svg`
  flex-shrink: 0;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  color: ${({ $rank }) => MEDAL_COLOR[$rank]};
  text {
    fill: var(--on-brand);
    font-family: var(--f-num);
  }
`

function Medal({ rank, size = 30 }) {
  if (!MEDAL_COLOR[rank]) return null
  return (
    <Svg viewBox="0 0 24 24" $rank={rank} $size={size} role="img" aria-label={`${rank}위`}>
      <path
        d="M8 1.5h3.2l1.6 6M16 1.5h-3.2l-1.6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={12} cy={15} r={7.5} fill="currentColor" />
      <text x={12} y={18.4} textAnchor="middle" fontSize={10} fontWeight={900}>
        {rank}
      </text>
    </Svg>
  )
}

export default Medal
