import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { Card } from '../../styles/common'

const GUIDE_PATH = '/help/illegal'

// 대응 3단계 (명세서: 1 상담 즉시 중단, 2 증거 보관, 3 기관 신고 (금융감독원 1332)). 한 줄 설명은 가안 기준
const STEPS = [
  { no: 1, title: '상담 즉시 중단', text: '돈이나 통장을 요구하면 그 자리에서 대화를 멈춰요.' },
  { no: 2, title: '증거 보관', text: '문자, 녹음, 계좌번호를 지우지 말고 남겨 둬요.' },
  { no: 3, title: '기관 신고', text: '금융감독원 1332에 바로 알려요.' },
]

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
  font-family: var(--f-ui);
`

const Title = styled.h2`
  margin: 0;
  color: var(--ink);
  font-size: var(--fs-h1);
  font-weight: 800;
`

const Lead = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-base);
  line-height: 1.6;
`

const Steps = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  align-self: stretch;
`

const StepCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
`

const StepNo = styled.span`
  color: var(--brand-text);
  font-family: var(--f-num);
  font-size: var(--fs-h4);
  font-weight: 900;
`

const StepTitle = styled.p`
  margin: 0;
  color: var(--ink);
  font-size: var(--fs-xl);
  font-weight: 800;
`

const StepText = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-md);
`

const GuideLink = styled(Link)`
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
  text-decoration: underline;
`

/*
    RC-12 불법 금융 대응 3단계 (SCR-01)
    - 큰 제목 + 한 줄 + 카드 3장 (1 상담 즉시 중단, 2 증거 보관, 3 기관 신고) + '대응 방법 자세히 보기' → /help/illegal
    - 글은 모두 고정 (서버 호출 없음). 카드 한 줄 설명은 가안 기준 (명세서에는 기관 신고의 '금융감독원 1332'만 있음)
*/
function IllegalSteps() {
  return (
    <Wrap aria-labelledby="illegal-title">
      <Title id="illegal-title">돈부터 보내라고 하면 불법이에요</Title>
      <Lead>
        수수료, 보증금 선입금, 연 20%를 넘는 이자, 통장이나 신분증 요구를 받으면 이 순서로 대응하세요.
      </Lead>
      <Steps>
        {STEPS.map((step) => (
          <li key={step.no}>
            <StepCard>
              <StepNo>{step.no}</StepNo>
              <StepTitle>{step.title}</StepTitle>
              {step.text && <StepText>{step.text}</StepText>}
            </StepCard>
          </li>
        ))}
      </Steps>
      <GuideLink to={GUIDE_PATH}>대응 방법 자세히 보기</GuideLink>
    </Wrap>
  )
}

export default IllegalSteps
