import { Link } from 'react-router-dom'
import styled from 'styled-components'
import Icon from '../ui/Icon'

// 도움말로 가는 알약 버튼 4개 (이동 주소는 화면 목록 순서대로)
const HELPS = [
  { label: '대출 용어 사전', to: '/help/terms' },
  { label: '필요 서류 체크', to: '/help/docs' },
  { label: '자주 묻는 질문', to: '/help/faq' },
  { label: '금융 TIP', to: '/help/tips' },
]

// 예시 서류 목록 (고정 글)
const SAMPLE_DOCS = ['신분증', '소득금액증명원', '재직증명서']

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 56px;
  font-family: var(--f-ui);

  @media (max-width: 899px) {
    gap: 28px;
  }
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

// 왼쪽에 글 판, 오른쪽에 그림 칸 (그림 칸이 DOM 순서로는 먼저라 order로 뒤로)
const Show = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.7fr);
  gap: 28px;

  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
`

// 예시 카드 두 장을 같은 자리에 두고 엇갈리게 (좁은 화면에서는 위아래로)
const Art = styled.div`
  position: relative;
  display: grid;
  place-items: center;
  order: 2;
  min-height: 520px;
  padding: 28px;
  overflow: hidden;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, var(--good-soft), var(--mist));

  @media (max-width: 899px) {
    order: 0;
    gap: 12px;
    min-height: 320px;
    padding: 20px;
  }
`

const SampleCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  grid-area: 1 / 1;
  width: min(360px, 100%);
  padding: 28px;
  border-radius: var(--r-lg);
  background: var(--paper);
  box-shadow: var(--shadow-pop);
  transform: ${({ $isFirst }) =>
    $isFirst ? 'translate(-90px, -115px) rotate(-3deg)' : 'translate(90px, 95px) rotate(2deg)'};

  @media (max-width: 899px) {
    grid-area: auto;
    padding: 20px;
    transform: none;
  }
`

const SampleKind = styled.span`
  color: var(--brand-text);
  font-size: var(--fs-xs);
  font-weight: 800;
`

const SampleName = styled.p`
  margin: 0;
  color: var(--ink);
  font-size: var(--fs-h4);
  font-weight: 800;
`

const SampleText = styled.p`
  margin: -8px 0 0;
  color: var(--ink-2);
  font-size: var(--fs-md);
  line-height: 1.6;
`

const SampleList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 16px;
  border-radius: var(--r-sm);
  background: var(--mist);
  list-style: none;
`

const SampleItem = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  font-size: var(--fs-md);
  font-weight: 700;

  & [data-icon='check'] {
    color: var(--good);
  }
`

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 28px;
  padding: 44px 40px;
  border-radius: var(--r-lg);
  background: var(--mist);

  @media (max-width: 899px) {
    padding: 28px 20px 20px;
  }
`

const PanelText = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: var(--fs-xl);
  line-height: 1.6;

  @media (max-width: 899px) {
    font-size: var(--fs-lg);
  }
`

const Pills = styled.nav`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`

// 검정 알약: 다른 화면으로 가는 버튼이라 글자 뒤에 ↗ (공통 Button과 같은 규칙: arrow를 -45도)
const Pill = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 48px;
  padding: 0 16px;
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
    height: auto;
    min-height: 48px;
    padding: 8px 12px;
    font-size: var(--fs-md);
    line-height: 1.3;
    white-space: normal;
  }
`

/*
    RC-11 도움말 바로가기 (SCR-01)
    - 큰 제목 + 한 줄 + 예시 그림 칸(용어 카드 1장, 필요 서류 목록 1장, 고정 글) + 알약 버튼 4개 → 누르면 이동
    - 서버 호출 없음. 예시 카드와 안내 문구는 가안 기준
*/
function HelpShortcuts() {
  return (
    <Wrap aria-labelledby="help-title">
      <Intro>
        <Title id="help-title">
          대출이
          <WideBr />
          어렵다면?
        </Title>
        <Lead>모르는 말과 준비할 서류부터 차근차근 알려드려요.</Lead>
      </Intro>
      <Show>
        <Art aria-hidden="true">
          <SampleCard $isFirst>
            <SampleKind>대출 용어 사전</SampleKind>
            <SampleName>DSR</SampleName>
            <SampleText>1년 소득 중 모든 대출의 원금과 이자를 갚는 데 쓰는 비율이에요.</SampleText>
          </SampleCard>
          <SampleCard>
            <SampleKind>필요 서류 체크</SampleKind>
            <SampleName>직장인이라면</SampleName>
            <SampleList>
              {SAMPLE_DOCS.map((doc) => (
                <SampleItem key={doc}>
                  <Icon name="check" size={14} />
                  {doc}
                </SampleItem>
              ))}
            </SampleList>
          </SampleCard>
        </Art>
        <Panel>
          <PanelText>
            어려운 말은 쉬운 말로, <br />
            준비할 서류는 내 상황에 맞게
          </PanelText>
          <Pills aria-label="도움말 바로가기">
            {HELPS.map((help) => (
              <Pill key={help.to} to={help.to}>
                {help.label}
                <Icon name="arrow" size={16} />
              </Pill>
            ))}
          </Pills>
        </Panel>
      </Show>
    </Wrap>
  )
}

export default HelpShortcuts
