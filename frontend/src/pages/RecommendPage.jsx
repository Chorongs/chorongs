import styled from 'styled-components'
import RecommendResult from '../components/recommend/RecommendResult'
import { useRecommendStore } from '../store/useRecommendStore'
import useUiStore from '../store/useUiStore'
import Icon from '../components/ui/Icon'
import { Button, EmptyBox } from '../styles/common'

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: 20px;
`

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`

const Title = styled.h1`
  margin: 0;
  color: var(--ink);
  font-family: var(--f-ui);
  font-size: var(--fs-h1);
  font-weight: 800;
`

const EmptyText = styled.p`
  margin: 0;
`

/*
    RC-15 추천 결과 화면 (SCR-27, /recommend)
    - 제목 '추천 결과' + [다시 추천받기] (추천받은 뒤에만) / 추천 결과(RC-07)
    - 추천받기 전: 안내 + [나에게 맞는 상품 추천받기]. 두 버튼 모두 추천 창 열기 (RC-14)
    - 결과는 useRecommendStore 값 그대로. 추천 실패는 추천 창 안에서 처리 (RecommendDialog)
    - 주소 연결(/recommend)은 App.jsx(LY-01, 공통 담당)에서
*/
function RecommendPage() {
  const result = useRecommendStore((state) => state.result)
  const openRecommend = useUiStore((state) => state.openRecommend)

  return (
    <Page>
      <Head>
        <Title>추천 결과</Title>
        {result && (
          <Button $variant="outline" onClick={() => openRecommend()}>
            <Icon name="refresh" />
            다시 추천받기
          </Button>
        )}
      </Head>
      {result ? (
        <RecommendResult />
      ) : (
        <EmptyBox>
          <EmptyText>
            아직 추천받은 결과가 없어요. 내 조건을 알려 주면 신청할 수 있는 대출을 순위대로 보여드려요.
          </EmptyText>
          <Button onClick={() => openRecommend()}>나에게 맞는 상품 추천받기</Button>
        </EmptyBox>
      )}
    </Page>
  )
}

export default RecommendPage
