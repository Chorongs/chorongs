import styled from 'styled-components'
import useUiStore from '../../store/useUiStore'
import { Button } from '../../styles/common'

const Wrap = styled.section`
  display: flex;
  align-items: center;
  min-height: calc(100vh - 108px);
`

const Intro = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
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

const Lead = styled.p`
  margin: 0;
  font-family: var(--f-ui);
  font-size: var(--fs-xl);
  line-height: 1.6;
  color: var(--ink-2);
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
      <Intro>
        <Title id="hero-title">대출, 더 이상 어렵지 않아요</Title>
        <Lead>신청할 수 있는 대출을 추천 이유와 함께 보여드려요</Lead>
        <Button $size="lg" onClick={() => openRecommend()}>
          나에게 맞는 상품 추천받기
        </Button>
      </Intro>
    </Wrap>
  )
}

export default HeroSection
