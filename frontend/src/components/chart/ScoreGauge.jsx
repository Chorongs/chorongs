import styled from 'styled-components'
import { Tag } from '../../styles/common'
import { CREDIT_BAND_LABEL } from '../../constants/options'

// CH-03 점수 반원 게이지: 반원 + 점수 + 구간 딱지 (신용 진단 결과)
// score: 점수 (0~1000 밖 값은 잘라 냄) / band: 구간 코드 (BAND1~5, 딱지 글은 options.js 표)
const MAX_SCORE = 1000

const Wrap = styled.div`
  position: relative;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  text-align: center;
`

const Svg = styled.svg`
  display: block;
  width: 100%;
  height: auto;
`

const Track = styled.path`
  fill: none;
  stroke: var(--viz-track);
  stroke-width: 16;
  stroke-linecap: round;
`

const Fill = styled(Track)`
  stroke: var(--brand-strong);
`

const Center = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
`

const Score = styled.b`
  font-family: var(--f-num);
  font-size: var(--fs-d1);
  font-variant-numeric: tabular-nums;
  font-weight: 900;
  line-height: 1;
`

const Max = styled.span`
  color: var(--muted);
  font-family: var(--f-num);
  font-size: var(--fs-md);
  font-weight: 600;
`

function clampScore(score) {
  const number = Number(score)
  if (!Number.isFinite(number)) return 0
  return Math.min(Math.max(number, 0), MAX_SCORE)
}

function ScoreGauge({ score, band }) {
  const safeScore = Math.round(clampScore(score))
  const percent = (safeScore / MAX_SCORE) * 100

  return (
    <Wrap role="img" aria-label={`신용 점수 ${safeScore}점 (${MAX_SCORE}점 만점)`}>
      <Svg viewBox="0 0 200 108" aria-hidden="true">
        <Track d="M 12 100 A 88 88 0 0 1 188 100" pathLength="100" />
        {percent > 0 && (
          <Fill d="M 12 100 A 88 88 0 0 1 188 100" pathLength="100" strokeDasharray={`${percent} 100`} />
        )}
      </Svg>
      <Center>
        <Score>{safeScore}</Score>
        <Max>/ {MAX_SCORE}</Max>
        {band && (
          <Tag $variant="acc">{CREDIT_BAND_LABEL[band] ?? band}</Tag>
        )}
      </Center>
    </Wrap>
  )
}

export default ScoreGauge
