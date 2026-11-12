import { Link } from 'react-router-dom'
import styled from 'styled-components'

// 다른 도구로 가는 알약 버튼 8개 (이동 주소는 화면 목록 순서대로)
const TOOLS = [
  { label: '상세 검색', to: '/search' },
  { label: '간편 검색', to: '/search/simple' },
  { label: '두 상품 비교', to: '/compare' },
  { label: '대출 랭킹', to: '/ranking' },
  { label: '대출 이자', to: '/calc' },
  { label: '상환능력 기반 대출', to: '/calc/reverse' },
  { label: '신용 셀프 진단', to: '/diagnosis/credit' },
  { label: '소비 습관 분석', to: '/diagnosis/habit' },
]

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
  display: grid;
  place-items: center;
  min-height: 320px;
  padding: 28px;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, var(--brand-soft), var(--warn-soft));
`

const SampleCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(400px, 100%);
  padding: 28px;
  border-radius: var(--r-lg);
  background: var(--paper);
  box-shadow: var(--shadow-pop);
`

const SampleTop = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  font-size: var(--fs-md);
  font-weight: 800;
`

const SampleBadge = styled.span`
  padding: 2px 8px;
  border-radius: var(--r-xs);
  background: var(--brand-soft);
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

const SampleNums = styled.div`
  display: flex;
  gap: 28px;
`

const SampleNum = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: ${({ $isRate }) => ($isRate ? 'var(--brand-text)' : 'var(--ink)')};
`

const SampleNumLabel = styled.span`
  color: var(--ink-2);
  font-size: var(--fs-xs);
`

const SampleNumValue = styled.span`
  font-family: var(--f-num);
  font-size: var(--fs-h2);
  font-weight: 900;
`

const SampleUnit = styled.span`
  color: var(--ink-2);
  font-size: var(--fs-md);
  font-weight: 700;
`

const SampleChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const SampleChip = styled.span`
  padding: 4px 8px;
  border-radius: var(--r-xs);
  background: var(--good-soft);
  color: var(--good);
  font-size: var(--fs-xs);
  font-weight: 800;
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
    RC-10 도구 바로가기 (SCR-01)
    - 큰 제목 + 한 줄 + 예시 그림 칸(추천 카드 1장, 고정 글) + 알약 버튼 8개 → 누르면 이동 (서버 호출 없음)
    - 예시 카드와 안내 문구는 가안 기준 (실제 추천 결과 아님)
*/
function ToolShortcuts() {
  return (
    <Wrap aria-labelledby="tool-title">
      <Intro>
        <Title id="tool-title">로그인 없어도 간편하게!</Title>
        <Lead>
          대출 찾기와 비교, 계산, 신용 진단까지 바로 써 보세요. 결과 저장만 회원이 할 수 있어요.
        </Lead>
      </Intro>
      <Show>
        <Art aria-hidden="true">
          <SampleCard>
            <SampleTop>
              추천 1위<SampleBadge>일치도 96%</SampleBadge>
            </SampleTop>
            <SampleName>다함 근로자 생활자금</SampleName>
            <SampleNums>
              <SampleNum $isRate>
                <SampleNumLabel>예상 금리</SampleNumLabel>
                <SampleNumValue>
                  2.00<SampleUnit>%</SampleUnit>
                </SampleNumValue>
              </SampleNum>
              <SampleNum>
                <SampleNumLabel>최대 한도</SampleNumLabel>
                <SampleNumValue>
                  1,000<SampleUnit>만원</SampleUnit>
                </SampleNumValue>
              </SampleNum>
            </SampleNums>
            <SampleChips>
              <SampleChip>후보 중 최저 금리</SampleChip>
              <SampleChip>신용점수 기준 없음</SampleChip>
            </SampleChips>
          </SampleCard>
        </Art>
        <Panel>
          <PanelText>조건에 맞는 대출을 찾고 비교하고, 매달 갚을 돈까지 미리 계산해 보세요</PanelText>
          <Pills aria-label="도구 바로가기">
            {TOOLS.map((tool) => (
              <Pill key={tool.to} to={tool.to}>
                {tool.label}
              </Pill>
            ))}
          </Pills>
        </Panel>
      </Show>
    </Wrap>
  )
}

export default ToolShortcuts
