import { Link } from 'react-router-dom'
import styled from 'styled-components'

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
  gap: 28px;
  font-family: var(--f-ui);
`

const Intro = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
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

const Show = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
  gap: 28px;

  @media (max-width: 899px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
`

const Art = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  min-height: 320px;
  padding: 28px;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, var(--good-soft), var(--mist));
`

const SampleCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(360px, 100%);
  padding: 20px 24px;
  border-radius: var(--r-lg);
  background: var(--paper);
  box-shadow: var(--shadow-pop);
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
  margin: 0;
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

  &::before {
    content: '✓';
    color: var(--good);
    font-weight: 900;
  }
`

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 28px;
  padding: 40px 32px;
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
`

const Pills = styled.nav`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
`

const Pill = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  background: var(--paper);
  color: var(--ink);
  font-size: var(--fs-md);
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    border-color: var(--brand);
    background: var(--brand-soft);
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
        <Title id="help-title">대출이 어렵다면?</Title>
        <Lead>모르는 말과 준비할 서류부터 차근차근 알려드려요.</Lead>
      </Intro>
      <Show>
        <Art aria-hidden="true">
          <SampleCard>
            <SampleKind>대출 용어 사전</SampleKind>
            <SampleName>DSR</SampleName>
            <SampleText>1년 소득 중 모든 대출의 원금과 이자를 갚는 데 쓰는 비율이에요.</SampleText>
          </SampleCard>
          <SampleCard>
            <SampleKind>필요 서류 체크</SampleKind>
            <SampleName>직장인이라면</SampleName>
            <SampleList>
              {SAMPLE_DOCS.map((doc) => (
                <SampleItem key={doc}>{doc}</SampleItem>
              ))}
            </SampleList>
          </SampleCard>
        </Art>
        <Panel>
          <PanelText>어려운 말은 쉬운 말로, 준비할 서류는 내 상황에 맞게</PanelText>
          <Pills aria-label="도움말 바로가기">
            {HELPS.map((help) => (
              <Pill key={help.to} to={help.to}>
                {help.label}
              </Pill>
            ))}
          </Pills>
        </Panel>
      </Show>
    </Wrap>
  )
}

export default HelpShortcuts
