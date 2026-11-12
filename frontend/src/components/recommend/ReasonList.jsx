import styled from 'styled-components'
import { useRecommendStore } from '../../store/useRecommendStore'

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: var(--r-sm);
  background: var(--mist);
  font-family: var(--f-ui);
  color: var(--ink);
`

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const Title = styled.h3`
  margin: 0;
  font-size: var(--fs-base);
  font-weight: 800;
`

const MatchRate = styled.span`
  color: var(--brand-text);
  font-family: var(--f-num);
  font-size: var(--fs-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`

const Reasons = styled.ul`
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--ink-2);
  font-size: var(--fs-md);
`

/*
    RC-09 추천 이유 목록 (추천 카드, 상품 상세 창 CM-07이 같이 씀)
    - props: productId
    - useRecommendStore의 result.items에서 product.productId가 같은 항목을 찾아 reasons(최대 5개), matchRate 표시
    - 문장은 서버가 완성해서 보냄 (화면은 글자로만 표시: E1). 추천 결과에 없는 상품이면 아무것도 안 그림
*/
function ReasonList({ productId }) {
  const item = useRecommendStore((state) =>
    state.result?.items.find((candidate) => candidate.product.productId === productId),
  )

  if (!item) return null

  return (
    <Wrap aria-label="추천 이유">
      <Head>
        <Title>추천 이유</Title>
        <MatchRate>일치도 {item.matchRate}%</MatchRate>
      </Head>
      <Reasons>
        {item.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </Reasons>
    </Wrap>
  )
}

export default ReasonList
