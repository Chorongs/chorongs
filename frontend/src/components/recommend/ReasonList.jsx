import styled from 'styled-components'
import { useRecommendStore } from '../../store/useRecommendStore'
import { formatMatchRate } from '../../utils/recommend'

// 제목 줄(제목 + 추천도)은 박스 위, 이유 줄만 연회색 박스 안에
const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  margin-top: 6px;
  font-family: var(--f-ui);
  color: var(--ink);
`

const Head = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 16px 0 4px;
`

const Title = styled.h3`
  margin: 0;
  font-size: var(--fs-base);
  font-weight: 800;
`

// 제목 옆 작은 글 '추천도 N%' (RC-09)
const MatchRate = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const Reasons = styled.ul`
  margin: 0;
  padding: 12px 16px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: var(--r-sm);
  background: var(--mist);
  color: var(--ink-2);
  font-size: var(--fs-sm);
  line-height: 1.5;
`

/*
    RC-09 추천 이유 목록 (추천 카드, 상품 상세 창 CM-07이 같이 씀)
    - props: productId
    - useRecommendStore의 result.items에서 product.productId가 같은 항목을 찾아 reasons(최대 5개), matchRate 표시
    - 문장은 서버가 완성해서 보냄 (화면은 글자로만 표시: E1). 추천 결과에 없는 상품이면 아무것도 안 그림
    - 이유 줄은 아이콘 없이 글자만 표시 (RC-09 '화면은 표시만', 서버 reasons는 좋음과 주의를 나누지 않은 글자 배열이고 중립 문장도 섞여 있음)
*/
function ReasonList({ productId }) {
  const item = useRecommendStore((state) =>
    state.result?.items?.find((candidate) => candidate.product.productId === productId),
  )

  if (!item) return null

  return (
    <Wrap aria-label="추천 이유">
      <Head>
        <Title>추천 이유</Title>
        <MatchRate>추천도 {formatMatchRate(item.matchRate)}%</MatchRate>
      </Head>
      <Reasons>
        {item.reasons.map((reason, index) => (
          <li key={`${index}-${reason}`}>{reason}</li>
        ))}
      </Reasons>
    </Wrap>
  )
}

export default ReasonList
