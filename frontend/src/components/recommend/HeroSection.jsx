import styled from 'styled-components'

// TODO(RC-02): 가안의 '약속 3줄' 문구로 채우기 (명세서에 문구 없음)
const PROMISES = []

const Wrap = styled.section`
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  align-items: start;

  @media (min-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
`

const Intro = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Title = styled.h1`
  margin: 0;
  font-family: var(--f-ui);
  font-size: var(--fs-d1);
  font-weight: 800;
  color: var(--ink);

  @media (max-width: 420px) {
    font-size: var(--fs-h1);
  }
`

const PromiseList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: var(--fs-base);
  line-height: 1.6;
  color: var(--ink-2);
`

const CardArea = styled.div`
  min-width: 0;
`

function HeroSection() {
  return (
    <Wrap aria-labelledby="hero-title">
      <Intro>
        <Title id="hero-title">대출, 더 이상 어렵지 않아요</Title>
        <PromiseList>
          {PROMISES.map((promise) => (
            <li key={promise}>{promise}</li>
          ))}
        </PromiseList>
      </Intro>
      <CardArea>
        {/* TODO(RC-03, UI-05): 공통 Panel(큰 회색 판) 안에 <RecommendStepper /> 넣기 (공통 부품이 올라온 뒤 연결) */}
      </CardArea>
    </Wrap>
  )
}

export default HeroSection
