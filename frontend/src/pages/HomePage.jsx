import styled from 'styled-components'
import HeroSection from '../components/recommend/HeroSection'

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: 28px;
`

/*
    RC-01 메인 화면 (SCR-01): 부품 배치만 함
    - 첫 방문 예시 결과(isDemo true, '예시 조건' 딱지)는 RecommendResult(RC-07) 만들 때 결정
*/
function HomePage() {
  return (
    <Page>
      <HeroSection />
      {/* TODO(RC-07): <RecommendResult /> (추천 결과, 추천 실패 시 결과 자리에 오류 + 다시 시도: E3) */}
      {/* TODO(RC-10): <ToolShortcuts /> (도구 바로가기) */}
      {/* TODO(RC-11): <HomeTipCards /> (금융 TIP 3개, API-12) */}
      {/* TODO(RC-12): <IllegalAlertStrip /> (불법 금융 경고 띠) */}
    </Page>
  )
}

export default HomePage
