import styled from 'styled-components'
import { useRecommendStore } from '../../store/useRecommendStore'
import { formatMatchRate } from '../../utils/recommend'

// 가안(.sh-sec): 제목 줄(제목 + 추천도)은 박스 위, 이유 줄만 연회색 박스 안에
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

// 제목 옆 작은 글 '조건 추천도 N%' (가안)
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
    - 참고(RC-09, 시안과 다름): 가안은 이유 줄 앞에 좋음은 체크, 주의는 느낌표 아이콘을 보여 주는데, 명세서 RC-09는 '표시만'이고 서버도 중립 문장이 섞인 글자 배열(reasons)이라 구분하지 않고 글자만 표시함 (명세서 변경 요청 A12)
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
        <MatchRate>조건 추천도 {formatMatchRate(item.matchRate)}%</MatchRate>
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
