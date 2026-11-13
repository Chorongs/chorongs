import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import Icon from '../ui/Icon'

const GUIDE_PATH = '/help/illegal'

// 대응 3단계 (명세서: 1 상담 즉시 중단, 2 증거 보관, 3 기관 신고 (금융감독원 1332)). 한 줄 설명은 가안 기준
// 한 줄 설명은 줄 단위로 나눔 (줄바꿈 위치는 가안 기준, 좁은 화면에서는 이어짐). 숫자는 빨간 강조
const STEPS = [
  {
    no: 1,
    title: '상담 즉시 중단',
    lines: [['돈이나 통장을 요구하면 '], ['그 자리에서 대화를 멈춰요.']],
  },
  { no: 2, title: '증거 보관', lines: [['문자, 녹음, 계좌번호를 '], ['지우지 말고 남겨 둬요.']] },
  { no: 3, title: '기관 신고', lines: [['금융감독원 ', 1332, '에 '], ['바로 알려요.']] },
]

// 단계 아이콘 (1 일시정지, 2 서류, 3 상담 헤드셋): 선 아이콘 viewBox 24
const STEP_ICON_SHAPES = {
  1: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  2: (
    <>
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M9.5 13h6M9.5 17h6" />
    </>
  ),
  3: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="13" width="4" height="6" rx="1.5" />
      <rect x="17" y="13" width="4" height="6" rx="1.5" />
    </>
  ),
}

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-family: var(--f-ui);
`

const Intro = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (max-width: 899px) {
    gap: 12px;
  }
`

const Title = styled.h2`
  margin: 0;
  color: var(--ink);
  font-size: var(--fs-d1);
  font-weight: 800;
  line-height: 1.22;
  letter-spacing: -0.04em;

  @media (max-width: 899px) {
    font-size: var(--fs-h1);
  }
`

const Lead = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-xl);
  line-height: 1.7;

  @media (max-width: 899px) {
    font-size: var(--fs-lg);
  }
`

// 넓은 화면에서만 줄바꿈 (좁은 화면에서는 자연스럽게 이어짐)
const WideBr = styled.br`
  @media (max-width: 899px) {
    display: none;
  }
`

const Steps = styled.ol`
  margin: 56px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 28px;
  align-self: stretch;

  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
    margin-top: 28px;
  }
`

// 그림 칸: 단계마다 바탕색과 아이콘 색이 다름 (1 주황 계열, 2 브랜드, 3 위험 빨강)
const STEP_ART = {
  1: { background: 'linear-gradient(160deg, var(--warn-soft), var(--mist) 70%)', color: 'var(--brand-text)' },
  2: { background: 'linear-gradient(200deg, var(--brand-soft), var(--mist) 70%)', color: 'var(--brand-text)' },
  3: { background: 'linear-gradient(160deg, var(--bad-soft), var(--mist) 70%)', color: 'var(--bad)' },
}

const StepArt = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3.4;
  border-radius: var(--r-lg);
  background: ${({ $no }) => STEP_ART[$no].background};
  color: ${({ $no }) => STEP_ART[$no].color};

  @media (max-width: 899px) {
    aspect-ratio: auto;
    height: 200px;
  }
`

const StepNo = styled.span`
  position: absolute;
  top: 20px;
  left: 20px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ink);
  color: var(--paper);
  font-family: var(--f-num);
  font-size: var(--fs-lg);
  font-weight: 900;
`

const StepIcon = styled.span`
  display: grid;
  place-items: center;
  width: 120px;
  height: 120px;
  border-radius: 32px;
  background: var(--paper);
  box-shadow: var(--shadow-pop);

  @media (max-width: 899px) {
    width: 88px;
    height: 88px;
    border-radius: 24px;
  }
`

// 선 아이콘 (공통 아이콘에 없는 pause, headset은 여기에 직접 그림)
const StepSvg = styled.svg`
  width: 56px;
  height: 56px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;

  @media (max-width: 899px) {
    width: 40px;
    height: 40px;
  }
`

const StepTitle = styled.h3`
  margin: 28px 20px 0;
  color: var(--ink);
  font-size: var(--fs-h3);
  font-weight: 800;

  @media (max-width: 899px) {
    margin: 20px 4px 0;
    font-size: var(--fs-h4);
  }
`

const StepText = styled.p`
  margin: 12px 20px 0;
  color: var(--ink-2);
  font-size: var(--fs-lg);
  line-height: 1.7;

  @media (max-width: 899px) {
    margin: 8px 4px 0;
    font-size: var(--fs-md);
  }
`

// 금융감독원 번호: 빨강 강조
const HotNumber = styled.b`
  color: var(--bad);
  font-family: var(--f-num);
  font-weight: 900;
`

// 검정 알약: 다른 화면으로 가는 버튼이라 글자 뒤에 ↗ (공통 Button과 같은 규칙: arrow를 -45도)
const GuideLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: fit-content;
  height: 48px;
  margin-top: 56px;
  padding: 0 28px;
  border-radius: 999px;
  background: var(--ink);
  color: var(--paper);
  font-size: var(--fs-base);
  font-weight: 800;
  white-space: nowrap;
  text-decoration: none;
  transition: background-color 0.15s;

  &:hover {
    background: var(--ink-2);
  }

  & [data-icon='arrow'] {
    transform: rotate(-45deg);
  }

  @media (max-width: 899px) {
    align-self: stretch;
    width: auto;
    margin-top: 28px;
    font-size: var(--fs-md);
  }
`

/*
    RC-12 불법 금융 대응 3단계 (SCR-01)
    - 큰 제목 + 한 줄 + 카드 3장 (1 상담 즉시 중단, 2 증거 보관, 3 기관 신고) + '대응 방법 자세히 보기' → /help/illegal
    - 글은 모두 고정 (서버 호출 없음). 카드 한 줄 설명은 가안 기준 (명세서에는 기관 신고의 '금융감독원 1332'만 있음)
*/
function IllegalSteps() {
  return (
    <Wrap aria-labelledby="illegal-title">
      <Intro>
        <Title id="illegal-title">
          돈부터 보내라고 하면
          <WideBr />
          불법이에요
        </Title>
        <Lead>
          수수료, 보증금 선입금, 연 20%를 넘는 이자, 통장이나 신분증 요구를 받으면 <WideBr />이
          순서로 대응하세요.
        </Lead>
      </Intro>
      <Steps aria-label="불법 금융 대응 순서">
        {STEPS.map((step) => (
          <li key={step.no}>
            <StepArt $no={step.no} aria-hidden="true">
              <StepNo>{step.no}</StepNo>
              <StepIcon>
                <StepSvg viewBox="0 0 24 24">{STEP_ICON_SHAPES[step.no]}</StepSvg>
              </StepIcon>
            </StepArt>
            <StepTitle>{step.title}</StepTitle>
            <StepText>
              {step.lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 && <WideBr />}
                  {line.map((part, partIndex) =>
                    typeof part === 'number' ? <HotNumber key={partIndex}>{part}</HotNumber> : part,
                  )}
                </Fragment>
              ))}
            </StepText>
          </li>
        ))}
      </Steps>
      <GuideLink to={GUIDE_PATH}>
        대응 방법 자세히 보기
        <Icon name="arrow" size={16} />
      </GuideLink>
    </Wrap>
  )
}

export default IllegalSteps
