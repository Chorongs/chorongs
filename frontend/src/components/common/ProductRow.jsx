import styled from 'styled-components'
import { FEATURE_LABEL } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Button, Tag } from '../../styles/common'
import LikeButton from './LikeButton'
import LimitText from './LimitText'
import RateText from './RateText'

// CM-04 상품 한 줄: 금융사 / 상품명 / 태그 2개 (상품 특징 앞 2개) / 금리 / 한도
// 줄 아무 곳 클릭, Enter → 상품 상세 창 (from: 추천에서 열면 'recommend')
// 줄 모양은 시안과 같게: 카드 없이 아래 구분선만, 목록(ProductList) 폭 720 이하에서 2줄 배치 (container query)
// rank, matchRate (선택): 맞춤 추천 4위부터 쓰는 줄. rank → 금융사 앞에 'N위', matchRate → 태그 맨 앞에 '일치도 N%' 주황 딱지 (CHORONG-45, 시안 prodRow의 opt.rank)
// 태그: (일치도) → 상품 소분류(SECTOR 태그, 예: 인터넷은행) → 상품 특징 앞 2개 (시안 prodRow). 명세서는 '상품 특징 앞 2개'만 있어 소분류는 변경 요청 중
// 오른쪽 끝 하트: 찜 버튼 LikeButton (CM-06, CHORONG-43에서 연결. 클릭이 줄까지 안 퍼지게 LikeButton이 e.stopPropagation)
// [+ 비교]: 시안 모양과 자리만 있고 동작은 달지 않았음 (연결 때 클릭이 줄까지 안 퍼지게 stopPropagation). 눌러도 반응이 없는 것에 대한 사용자 안내는 CHORONG-43이 시연 전 일괄 처리하기로 함
//   720 이하에서는 3열(1fr 1fr auto)로 바뀌어 1행 오른쪽에 있고, 480 이하에서는 [+ 비교]가 숨음
// TODO(ST-04, CHORONG-47 조빌립): [+ 비교]를 useCompareStore.addTray(product)로 교체, 담긴 상품은 '담김' 모양 (CompareButton)
// TODO(CHORONG-64 조빌립, 상품 찾기 간편 검색): 시안은 태그 자리에 'N/M 일치' 글 + 초록 충족 태그(체크 아이콘)를 보여 줌. 이 줄에 hits 같은 props로 추가 (상세 검색은 그대로)
// TODO(CM-04, CHORONG-68 조빌립): 줄 전체가 role="button"인데 안에 하트, [+ 비교] 버튼이 또 있어 화면 낭독기에서 버튼 안의 버튼으로 읽힘 (카드도 같음). 줄 전체 클릭은 상품명 버튼 하나로 두고 줄 클릭은 마우스용으로만 두는 방식 검토
// 랭킹(RK-02, CHORONG-60)은 순위 숫자 칸, 1~3위 메달 카드, '최저 금리' 이름표가 달라 이 줄을 쓰지 않고 components/ranking/RankingItem.jsx로 따로 만듦
const Row = styled.article`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 168px 128px auto;
  gap: 20px;
  align-items: center;
  padding: 20px 2px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  @container plist (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 2px 12px;
    align-items: start;
    padding: 18px 0;
  }
`

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  @container plist (max-width: 720px) {
    grid-column: 1 / 3;
    grid-row: 1;
  }
`

const Org = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const RankNo = styled.b`
  margin-right: 8px;
  color: var(--brand-text);
  font-family: var(--f-num);
  font-weight: 900;
`

// 상품명이 길면 2줄에서 자름. 줄 위에 마우스를 올리면 밑줄
const Name = styled.span`
  display: -webkit-box;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--fs-lg);
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.4;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  ${Row}:hover & {
    text-decoration: underline;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 4px;
  }
`

// 오른쪽 끝 버튼 묶음: 찜 + 비교. 720 이하에서는 1행 오른쪽, 480 이하에서는 [+ 비교] 숨김
const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  @container plist (max-width: 720px) {
    grid-column: 3;
    grid-row: 1;
  }
  @container plist (max-width: 480px) {
    margin-right: -8px;
    & > button:last-child {
      display: none;
    }
  }
`

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
`

const Metric = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  @container plist (max-width: 720px) {
    margin-top: 8px;
    grid-row: 2;
    grid-column: ${({ $slot }) => $slot};
  }
`

const MetricLabel = styled.span`
  margin-bottom: 1px;
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 600;
`

const MetricValue = styled.b`
  color: ${({ $isRate }) => ($isRate ? 'var(--brand-text)' : 'inherit')};
  font-family: var(--f-num);
  font-size: var(--fs-h3);
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
  white-space: nowrap;
  @container plist (max-width: 720px) {
    font-size: var(--fs-xl);
  }
`

const Memo = styled.span`
  color: var(--cocoa);
  font-family: var(--f-ui);
  font-size: var(--fs-sm);
  font-weight: 700;
`

function RateCell({ product }) {
  const { rateMin, rateMax } = product
  if (rateMin == null && rateMax == null) return <Memo>금리는 기관 문의</Memo>
  return <RateText min={rateMin} max={rateMax} hasFixedLabel unitTone="soft" />
}

// 중도상환수수료 없음, 정부/서민 지원은 주황 딱지로 눈에 띄게
const ACCENT_FEATURES = ['NO_PREPAY_FEE', 'POLICY']

function ProductRow({ product, from = null, rank = null, matchRate = null }) {
  const openProduct = useUiStore((state) => state.openProduct)
  const featureTags = (product.features ?? []).slice(0, 2)
  const sector = (product.tags ?? []).find((tag) => tag.tagType === 'SECTOR')?.tagValue

  const handleOpen = () => openProduct(product.productId, from)

  const handleKeyDown = (event) => {
    // 줄 안의 버튼에서 누른 Enter는 그 버튼 몫
    if (event.key === 'Enter' && event.target === event.currentTarget) handleOpen()
  }

  return (
    <Row role="button" tabIndex={0} onClick={handleOpen} onKeyDown={handleKeyDown}>
      <Info>
        <Org>
          {rank != null && <RankNo>{rank}위</RankNo>}
          {product.companyName}
        </Org>
        <Name>{product.productName}</Name>
        {(matchRate != null || sector || featureTags.length > 0) && (
          <Tags>
            {matchRate != null && <Tag $variant="acc">일치도 {matchRate}%</Tag>}
            {sector && <Tag>{sector}</Tag>}
            {featureTags.map((code) => (
              <Tag key={code} $variant={ACCENT_FEATURES.includes(code) ? 'acc' : undefined}>
                {FEATURE_LABEL[code] ?? code}
              </Tag>
            ))}
          </Tags>
        )}
      </Info>
      <Metric $slot={1}>
        <MetricLabel>금리</MetricLabel>
        <MetricValue $isRate>
          <RateCell product={product} />
        </MetricValue>
      </Metric>
      <Metric $slot={2}>
        <MetricLabel>최대 한도</MetricLabel>
        <MetricValue>
          <LimitText product={product} />
        </MetricValue>
      </Metric>
      <Actions>
        <LikeButton productId={product.productId} />
        <Button $variant="outline" $size="sm">
          + 비교
        </Button>
      </Actions>
    </Row>
  )
}

export default ProductRow
