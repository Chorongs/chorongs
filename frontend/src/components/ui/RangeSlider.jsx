import { useId } from 'react'
import styled from 'styled-components'

// UI-22 슬라이더: 막대를 끌어서 값 고르기 (input type=range, 키보드 좌우로도 조정)
// 값은 부모가 관리 (value, onChange). min ~ max 밖 값은 잘라 냄
// valueText: 오른쪽에 보이는 현재 값 글자 (없으면 숫자) / 막대 가운데에 기준 표시
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Head = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
`

const Label = styled.label`
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
`

const Current = styled.output`
  color: var(--ink);
  font-family: var(--f-num);
  font-size: var(--fs-xl);
  font-weight: 700;
`

const Track = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  height: 30px;
  /* 가운데 기준 표시 */
  &::before {
    content: '';
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: 50%;
    width: 2px;
    background: var(--line-2);
  }
`

// 시안처럼 브라우저 기본 막대에 주황 색만 입힘 (높이 30)
const Slider = styled.input`
  position: relative;
  width: 100%;
  height: 30px;
  margin: 0;
  accent-color: var(--brand-strong);
  cursor: pointer;
`

function RangeSlider({ label, value, onChange, min = 0, max = 100, step = 1, valueText }) {
  const inputId = useId()
  const clamp = (number) => Math.min(Math.max(number, min), max)
  const current = clamp(Number(value) || 0)

  return (
    <Wrap>
      <Head>
        {label && <Label htmlFor={inputId}>{label}</Label>}
        <Current htmlFor={inputId}>{valueText ?? current}</Current>
      </Head>
      <Track>
        <Slider
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
        />
      </Track>
    </Wrap>
  )
}

export default RangeSlider
