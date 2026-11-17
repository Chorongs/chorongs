import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { formatNumber } from '../../utils/format'

// CH-01 누적 막대 그래프: 막대 하나에 값 2개를 쌓는다 (원금/이자, 넣은 돈/쌓인 이자). 차트 라이브러리 없이 SVG로 직접 그림
// 모양은 시안과 같게: 실제 폭 그대로 그려 글자가 안 커지고, 눈금선 + 왼쪽 금액 글자, 위가 둥근 막대, 마우스 올린 칸 음영, 어두운 말풍선
// data: [{ label, first, second }] (first가 아래, second가 위) / title: 위 제목 / firstLabel, secondLabel: 범례 글
// unit: 금액 단위 ('원' 기본, 만원 단위 값이면 '만원') / isCumulative: 값이 누적이면 true (묶을 때 합치지 않고 마지막 값을 씀)
// 회차가 GROUP_OVER개를 넘으면 GROUP_SIZE개씩 묶어서 그린다 (값이 0이어도 NaN 없이 빈 그래프)
const GROUP_OVER = 60
const GROUP_SIZE = 12
const PAD = { left: 50, right: 6, top: 26, bottom: 28 }
const TOOLTIP_WIDTH = 160

const Wrap = styled.div`
  position: relative;
`

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
`

const Title = styled.h3`
  font-size: var(--fs-base);
  font-weight: 800;
`

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--ink-2);
  font-size: var(--fs-xs);
  font-weight: 600;
  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
`

const Swatch = styled.i`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: ${({ $color }) => $color};
`

const Svg = styled.svg`
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  text {
    fill: var(--muted);
    font-family: var(--f-num);
    font-size: var(--fs-2xs);
    font-weight: 700;
  }
`

const GridLine = styled.line`
  stroke: var(--line);
  stroke-width: 1;
`

const BaseLine = styled.line`
  stroke: var(--line-2);
  stroke-width: 1;
`

const FirstBar = styled.rect`
  fill: var(--viz-1);
`

const SecondBar = styled.path`
  fill: var(--viz-2);
`

const FirstBarRounded = styled.path`
  fill: var(--viz-1);
`

// 마우스, 터치를 받는 세로 칸. 올리면 연한 음영
const HitColumn = styled.rect`
  fill: ${({ $isOn }) => ($isOn ? 'var(--ink)' : 'transparent')};
  fill-opacity: 0.05;
  cursor: pointer;
`

const Tooltip = styled.div`
  position: absolute;
  z-index: 5;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  min-width: 150px;
  padding: 10px 12px;
  border-radius: var(--r-sm);
  background: var(--ink);
  box-shadow: var(--shadow-pop);
  color: var(--paper);
  font-size: var(--fs-xs);
  line-height: 1.55;
  white-space: nowrap;
  pointer-events: none;
  transform: translate(-50%, -100%);
`

const TooltipTitle = styled.div`
  margin-bottom: 4px;
  font-weight: 800;
`

const TooltipRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  b {
    font-family: var(--f-num);
    font-weight: 800;
  }
  i {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 6px;
    border-radius: 2px;
    background: ${({ $color }) => $color};
  }
`

function toAmount(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

// 눈금 간격을 1, 2, 2.5, 5, 10 x 10의 거듭제곱 중에서 고름 (눈금 4칸 안팎)
function getNiceStep(max, count) {
  const raw = max / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * power
}

// 눈금 글자: 1만 이상은 '만' 단위 (30만 / 1.5만), 그 아래는 숫자 그대로
function formatAxis(value) {
  const man = value / 10000
  if (man >= 1) return `${man >= 100 ? formatNumber(Math.round(man)) : Number(man.toFixed(1))}만`
  return formatNumber(value)
}

// 위 두 모서리만 둥근 막대 경로
function getTopRoundedPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height)
  if (height <= 0 || width <= 0) return ''
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`
}

// 회차가 많으면 GROUP_SIZE개씩 묶는다. axisLabel은 아래 글자(묶음의 첫 회차)
function groupBars(data, isCumulative) {
  const size = data.length > GROUP_OVER ? GROUP_SIZE : 1
  const bars = []
  for (let start = 0; start < data.length; start += size) {
    const chunk = data.slice(start, start + size)
    const last = chunk[chunk.length - 1]
    bars.push({
      axisLabel: chunk[0].label,
      label: chunk.length === 1 ? chunk[0].label : `${chunk[0].label}~${last.label}`,
      first: isCumulative ? toAmount(last.first) : chunk.reduce((sum, item) => sum + toAmount(item.first), 0),
      second: isCumulative ? toAmount(last.second) : chunk.reduce((sum, item) => sum + toAmount(item.second), 0),
    })
  }
  return bars
}

function StackedBarChart({
  data = [],
  title,
  firstLabel = '원금',
  secondLabel = '이자',
  unit = '원',
  isCumulative = false,
}) {
  const wrapRef = useRef(null)
  const [width, setWidth] = useState(720)
  const [activeIndex, setActiveIndex] = useState(null)

  // 화면 폭이 바뀌면 그 폭 그대로 다시 그림 (글자가 늘어나지 않게)
  useEffect(() => {
    const element = wrapRef.current
    if (!element) return undefined
    const observer = new ResizeObserver(() => {
      setWidth(Math.max(300, Math.round(element.clientWidth)))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const bars = groupBars(data, isCumulative)
  const height = Math.round(Math.min(250, Math.max(200, width * 0.34)))
  const innerWidth = width - PAD.left - PAD.right
  const innerHeight = height - PAD.top - PAD.bottom
  const baseY = PAD.top + innerHeight

  const maxTotal = Math.max(0, ...bars.map((bar) => bar.first + bar.second))
  const step = maxTotal > 0 ? getNiceStep(maxTotal, 4) : 1
  const maxY = maxTotal > 0 ? Math.ceil(maxTotal / step) * step : 1
  const yOf = (value) => baseY - (value / maxY) * innerHeight

  const columnWidth = bars.length > 0 ? innerWidth / bars.length : innerWidth
  const gap = columnWidth >= 6 ? 2 : columnWidth >= 3 ? 1 : 0
  const barWidth = Math.max(1, columnWidth - gap)

  const gridValues = []
  for (let value = 0; value <= maxY + 1e-6; value += step) gridValues.push(value)

  // 아래 글자는 많아도 7개 (겹치지 않게)
  const maxTicks = Math.max(2, Math.floor(innerWidth / 46))
  const tickCount = Math.min(bars.length, maxTicks, bars.length > 12 ? 7 : 99)
  const tickIndexes = new Set()
  for (let tick = 0; tick < tickCount; tick += 1) {
    tickIndexes.add(Math.round((tick * (bars.length - 1)) / Math.max(1, tickCount - 1)))
  }

  const active = activeIndex === null ? null : bars[activeIndex]
  // 말풍선은 그래프 밖으로 안 나가게 좌우를 제한, 막대 위(막대가 높으면 맨 위 근처)에 둔다
  const tipLeft = active
    ? Math.min(width - TOOLTIP_WIDTH / 2 - 4, Math.max(TOOLTIP_WIDTH / 2 + 4, PAD.left + (activeIndex + 0.5) * columnWidth))
    : 0
  const tipTop = active ? Math.max(90, yOf(active.first + active.second) - 10) : 0

  return (
    <Wrap ref={wrapRef} onMouseLeave={() => setActiveIndex(null)}>
      <Head>
        {title && <Title>{title}</Title>}
        <Legend>
          <span>
            <Swatch $color="var(--viz-1)" />
            {firstLabel}
          </span>
          <span>
            <Swatch $color="var(--viz-2)" />
            {secondLabel}
          </span>
        </Legend>
      </Head>

      <Svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${firstLabel}과 ${secondLabel} 누적 막대 그래프`}>
        {gridValues.map((value) => (
          <g key={value}>
            <GridLine x1={PAD.left} x2={width - PAD.right} y1={yOf(value)} y2={yOf(value)} />
            <text x={PAD.left - 8} y={yOf(value) + 4} textAnchor="end">
              {maxTotal > 0 ? formatAxis(value) : ''}
            </text>
          </g>
        ))}

        {bars.map((bar, index) => {
          const x = PAD.left + index * columnWidth + gap / 2
          const firstHeight = (bar.first / maxY) * innerHeight
          const secondHeight = (bar.second / maxY) * innerHeight
          // 아래 막대와 위 막대 사이에 2px 틈 (둘 다 있을 때)
          const seam = firstHeight > 0 && secondHeight > 0 && firstHeight + secondHeight > 4 ? 2 : 0
          return (
            <g key={index}>
              {firstHeight > 0 &&
                (secondHeight > 0 ? (
                  <FirstBar x={x} y={baseY - firstHeight} width={barWidth} height={firstHeight} />
                ) : (
                  <FirstBarRounded d={getTopRoundedPath(x, baseY - firstHeight, barWidth, firstHeight, 4)} />
                ))}
              {secondHeight > 0 && (
                <SecondBar
                  d={getTopRoundedPath(x, baseY - firstHeight - secondHeight, barWidth, Math.max(0, secondHeight - seam), 4)}
                />
              )}
              <HitColumn
                $isOn={activeIndex === index}
                x={PAD.left + index * columnWidth}
                y={PAD.top}
                width={columnWidth}
                height={innerHeight}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
              />
            </g>
          )
        })}

        <BaseLine x1={PAD.left} x2={width - PAD.right} y1={baseY} y2={baseY} />

        {bars.map((bar, index) =>
          tickIndexes.has(index) ? (
            <text key={index} x={PAD.left + (index + 0.5) * columnWidth} y={height - 8} textAnchor="middle">
              {bar.axisLabel}
            </text>
          ) : null,
        )}
      </Svg>

      {active && (
        <Tooltip $left={tipLeft} $top={tipTop} role="status">
          <TooltipTitle>{active.label}</TooltipTitle>
          <TooltipRow $color="var(--viz-1)">
            <span>
              <i />
              {firstLabel}
            </span>
            <b>
              {formatNumber(active.first)}
              {unit}
            </b>
          </TooltipRow>
          <TooltipRow $color="var(--viz-2)">
            <span>
              <i />
              {secondLabel}
            </span>
            <b>
              {formatNumber(active.second)}
              {unit}
            </b>
          </TooltipRow>
        </Tooltip>
      )}
    </Wrap>
  )
}

export default StackedBarChart
