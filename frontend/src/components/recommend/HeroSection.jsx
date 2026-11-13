import styled from 'styled-components'
import useUiStore from '../../store/useUiStore'
import { Button } from '../../styles/common'
import Icon from '../ui/Icon'

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  min-height: calc(100vh - 108px);
  padding: 56px 20px;
  border-radius: var(--r-lg);
  background:
    radial-gradient(60% 70% at 30% 35%, var(--brand-soft), transparent 70%),
    radial-gradient(50% 60% at 75% 70%, var(--warn-soft), transparent 70%), var(--paper);
  text-align: center;

  @media (max-width: 899px) {
    gap: 16px;
    padding: 40px 16px;
  }
`

const Title = styled.h1`
  margin: 0;
  font-family: var(--f-ui);
  font-size: var(--fs-d1);
  font-weight: 800;
  line-height: 1.18;
  letter-spacing: -0.05em;
  color: var(--ink);

  @media (max-width: 1279px) {
    font-size: var(--fs-d2);
  }

  @media (max-width: 420px) {
    font-size: var(--fs-h1);
  }
`

// 제목 끝의 삼선 효과(반짝이는 느낌): 글자 크기에 맞춰 커지고 줄어듦
const Spark = styled.svg`
  display: inline-block;
  width: 0.72em;
  height: 0.72em;
  margin: -0.16em 0 0 0.04em;
  vertical-align: top;
  fill: none;
  stroke: var(--sun);
  stroke-width: 3;
  stroke-linecap: round;
`

const Lead = styled.p`
  margin: 0;
  font-family: var(--f-ui);
  font-size: var(--fs-xl);
  line-height: 1.7;
  color: var(--ink-2);

  @media (max-width: 899px) {
    font-size: var(--fs-lg);
  }
`

const Cta = styled(Button)`
  margin-top: 20px;
  padding: 0 28px;

  @media (max-width: 899px) {
    width: 100%;
    margin-top: 12px;
  }
`

/*
    RC-02 소개 영역 (첫 화면 가득)
    - 소개 글 + [나에게 맞는 상품 추천받기] → 추천 창 열기 (RC-14, useUiStore.openRecommend)
    - 글은 모두 고정 (서버 호출 없음). 아래 화살표 없음
*/
function HeroSection() {
  const openRecommend = useUiStore((state) => state.openRecommend)

  return (
    <Wrap aria-labelledby="hero-title">
      <Title id="hero-title">
        대출, 더 이상
        <Spark viewBox="0 0 40 40" aria-hidden="true">
          <path d="M9 15 18 5.5" />
          <path d="M12.5 21.5 29 19" />
          <path d="M11 28.5 19.5 35" />
        </Spark>
        <br />
        어렵지 않아요
      </Title>
      <Lead>신청할 수 있는 대출을 추천 이유와 함께 보여드려요</Lead>
      <Cta $size="lg" onClick={() => openRecommend()}>
        <Icon name="spark" />
        나에게 맞는 상품 추천받기
      </Cta>
    </Wrap>
  )
}

export default HeroSection
