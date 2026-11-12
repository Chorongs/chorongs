import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, Card, Tag } from '../../styles/common'
import Medal from '../common/Medal'
import MoneyText from '../common/MoneyText'
import RateText from '../common/RateText'

const TOP_RANK = 3
const MAN_WON = 10000 // 만원 → 원
const CALC_PATH = '/calc'

const isPositiveNumber = (value) => typeof value === 'number' && value > 0

// [이자 계산]으로 계산기(CA-01)에 넘길 값. 값이 없는 칸은 빼고 보냄 (계산기 기본값을 쓰게)
// - 금액(원): 필요 금액(lastInput.need)과 한도 중 작은 값 (만원 x 10,000)
// - 기간(개월): 갚을 기간과 최대 기간(termMax) 중 짧은 값. '잘 모르겠어요'(0)이면 안 넘김
// - 금리: 예상 금리 가운데 값
// - 방식: 상품 상환 방식(REPAY 태그)이 만기일시만이면 BULLET, 그 밖은 EQUAL_PI (추천 월 상환과 같은 기준)
const getCalcState = (item, lastInput) => {
  const { product, estRateMin, estRateMax } = item
  const state = {}

  const amounts = [lastInput?.need, product.limitAmount].filter(isPositiveNumber)
  if (amounts.length > 0) state.loanAmount = Math.min(...amounts) * MAN_WON

  if (isPositiveNumber(lastInput?.months)) {
    state.loanMonths = Math.min(...[lastInput.months, product.termMax].filter(isPositiveNumber))
  }

  const rates = [estRateMin, estRateMax].filter((rate) => typeof rate === 'number')
  if (rates.length > 0) {
    const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
    state.interestRate = Math.round(mean * 100) / 100
  }

  const repayTags = (product.tags ?? []).filter((tag) => tag.tagType === 'REPAY')
  const isBulletOnly = repayTags.length > 0 && repayTags.every((tag) => tag.tagValue === '만기일시')
  state.repayMethod = isBulletOnly ? 'BULLET' : 'EQUAL_PI'

  return state
}

const Wrap = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: var(--f-ui);
  color: var(--ink);
  cursor: pointer;
  /* 1~3위는 주황 테두리 2px (자리는 그대로, 그림자로 그림) */
  box-shadow: ${({ $isTop }) => ($isTop ? '0 0 0 2px var(--brand)' : 'var(--shadow-1)')};
`

const Top = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const RankText = styled.span`
  font-size: var(--fs-md);
  font-weight: 800;
`

const MatchRate = styled.span`
  margin-left: auto;
  color: var(--brand-text);
  font-family: var(--f-num);
  font-size: var(--fs-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`

const Org = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const Name = styled.span`
  font-size: var(--fs-xl);
  font-weight: 800;
  line-height: 1.4;
`

const Metrics = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
`

const Metric = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const MetricLabel = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 600;
`

const MetricValue = styled.b`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: ${({ $isRate }) => ($isRate ? 'var(--brand-text)' : 'inherit')};
  font-family: var(--f-num);
  font-size: var(--fs-xl);
  font-weight: 700;
`

const Memo = styled.span`
  color: var(--cocoa);
  font-family: var(--f-ui);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`

const Note = styled.p`
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-xs);
`

// 한도가 숫자가 아니면 종류 글 (한도 제한 없음, 심사 후 결정 등), 그것도 없으면 '기관 문의'
function LimitValue({ product }) {
  if (typeof product.limitAmount === 'number') {
    return <MoneyText value={product.limitAmount} unitTone="muted" />
  }
  const amountTag = (product.tags ?? []).find((tag) => tag.tagType === 'AMOUNT')
  return <Memo>{amountTag?.tagValue ?? '기관 문의'}</Memo>
}

/*
    RC-08 추천 카드: 추천 상품 1개 요약
    - props: item (RecommendItemDTO: rankNo, product, matchRate, estRateMin, estRateMax, rateEstimated, monthlyPayment, calcNote, judgeTags)
    - 카드 아무 곳 클릭 (Enter) → 상품 상세 창 openProduct(id, 'recommend')
    - [이자 계산] → navigate('/calc', { state }) / 버튼 클릭은 카드 클릭으로 안 퍼지게 함
    - 판단 태그는 서버가 보낸 글 그대로, 순서도 그대로 (서버가 주의 먼저 정렬). 서버 글은 글자로만 출력 (E1)
    - TODO(CM-06, CHORONG-43): 찜 버튼 LikeButton 연결 (상품명 줄 오른쪽, 클릭이 카드까지 안 퍼지게 e.stopPropagation)
    - TODO(ST-04, CHORONG-47): [+ 비교] 버튼을 [이자 계산] 옆에 연결 (useCompareStore.addTray(product), 클릭이 안 퍼지게)
    - TODO(RC-08): judgeTags가 글자 배열이라고 가정 (BE DTO 확인 필요)
*/
function RecommendCard({ item }) {
  const { rankNo, product, matchRate, estRateMin, estRateMax, rateEstimated, monthlyPayment, calcNote, judgeTags } = item
  const navigate = useNavigate()
  const openProduct = useUiStore((state) => state.openProduct)
  const lastInput = useRecommendStore((state) => state.lastInput)

  const isTop = rankNo <= TOP_RANK
  const hasRate = estRateMin != null || estRateMax != null

  const handleOpen = () => openProduct(product.productId, 'recommend')

  const handleKeyDown = (event) => {
    // 카드 안 버튼에서 누른 Enter는 그 버튼 몫
    if (event.key === 'Enter' && event.target === event.currentTarget) handleOpen()
  }

  const handleCalc = (event) => {
    event.stopPropagation()
    navigate(CALC_PATH, { state: getCalcState(item, lastInput) })
  }

  return (
    <Wrap as="article" $isTop={isTop} role="button" tabIndex={0} onClick={handleOpen} onKeyDown={handleKeyDown}>
      <Top>
        {isTop && <Medal rank={rankNo} size={26} />}
        <RankText>추천 {rankNo}위</RankText>
        <MatchRate>일치도 {matchRate}%</MatchRate>
      </Top>

      <div>
        <Org>{product.companyName}</Org>
        <br />
        <Name>{product.productName}</Name>
      </div>

      <Metrics>
        <Metric>
          <MetricLabel>예상 금리</MetricLabel>
          <MetricValue $isRate>
            {hasRate ? (
              <>
                <RateText min={estRateMin} max={estRateMax} hasFixedLabel unitTone="soft" />
                {rateEstimated && <Tag>추정</Tag>}
              </>
            ) : (
              <Memo>금리는 기관 문의</Memo>
            )}
          </MetricValue>
        </Metric>
        <Metric>
          <MetricLabel>최대 한도</MetricLabel>
          <MetricValue>
            <LimitValue product={product} />
          </MetricValue>
        </Metric>
        <Metric>
          <MetricLabel>예상 월 상환</MetricLabel>
          <MetricValue>
            <MoneyText value={monthlyPayment} unit="원" unitTone="muted" />
          </MetricValue>
        </Metric>
      </Metrics>

      {judgeTags.length > 0 && (
        <Tags>
          {judgeTags.map((tag, index) => (
            <Tag key={`${tag}-${index}`}>{tag}</Tag>
          ))}
        </Tags>
      )}

      <Actions>
        <Button $variant="outline" $size="sm" onClick={handleCalc}>
          이자 계산
        </Button>
      </Actions>

      {calcNote && <Note>{calcNote}</Note>}
    </Wrap>
  )
}

export default RecommendCard
