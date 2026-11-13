import { Link } from 'react-router-dom'
import styled from 'styled-components'
import Icon from '../ui/Icon'

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

// 예시 카드 아래 칩 (고정 글)
const SAMPLE_CHIPS = ['후보 중 최저 금리', '신용점수 기준 없음']

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
  position: relative;
  display: grid;
  place-items: center;
  min-height: 520px;
  padding: 28px;
  overflow: hidden;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, var(--brand-soft), var(--warn-soft));

  @media (max-width: 899px) {
    min-height: 320px;
    padding: 20px;
  }
`

const SampleCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(400px, 100%);
  padding: 28px;
  border-radius: var(--r-lg);
  background: var(--paper);
  box-shadow: var(--shadow-pop);

  @media (max-width: 899px) {
    padding: 20px;
  }
`

// 예시 카드 뒤에 살짝 비껴 깔리는 빈 카드 (좁은 화면에서는 숨김)
const BackCard = styled(SampleCard)`
  position: absolute;
  height: 260px;
  opacity: 0.6;
  transform: translate(36px, -28px) rotate(4deg);

  @media (max-width: 899px) {
    display: none;
  }
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
  color: var(--cocoa);
  font-size: var(--fs-xs);
`

const SampleNumValue = styled.span`
  font-family: var(--f-num);
  font-size: var(--fs-h2);
  font-weight: 900;
`

const SampleUnit = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-md);
  font-weight: 700;
`

const SampleChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const SampleChip = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
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

// 칩 앞 체크 아이콘 (원 안에 체크, 공통 아이콘에는 없어서 여기에 직접 그림)
const CheckCircle = styled.svg`
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
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
    RC-10 도구 바로가기 (SCR-01)
    - 큰 제목 + 한 줄 + 예시 그림 칸(추천 카드 1장, 고정 글) + 알약 버튼 8개 → 누르면 이동 (서버 호출 없음)
    - 예시 카드와 안내 문구는 가안 기준 (실제 추천 결과 아님)
*/
function ToolShortcuts() {
  return (
    <Wrap aria-labelledby="tool-title">
      <Intro>
        <Title id="tool-title">
          로그인 없어도
          <WideBr />
          간편하게!
        </Title>
        <Lead>
          대출 찾기와 비교, 계산, 신용 진단까지 바로 써 보세요. <WideBr />결과 저장만 회원이 할 수
          있어요.
        </Lead>
      </Intro>
      <Show>
        <Art aria-hidden="true">
          <BackCard />
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
              {SAMPLE_CHIPS.map((chip) => (
                <SampleChip key={chip}>
                  <CheckCircle viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8 12.2 2.7 2.7L16 9.5" />
                  </CheckCircle>
                  {chip}
                </SampleChip>
              ))}
            </SampleChips>
          </SampleCard>
        </Art>
        <Panel>
          <PanelText>
            조건에 맞는 대출을 찾고 비교하고, <br />
            매달 갚을 돈까지 미리 계산해 보세요
          </PanelText>
          <Pills aria-label="도구 바로가기">
            {TOOLS.map((tool) => (
              <Pill key={tool.to} to={tool.to}>
                {tool.label}
                <Icon name="arrow" size={16} />
              </Pill>
            ))}
          </Pills>
        </Panel>
      </Show>
    </Wrap>
  )
}

export default ToolShortcuts
