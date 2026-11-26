import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import useCompareStore, { getCompareBase, getCompareBlock, getPickBaseSlot } from '../../store/useCompareStore'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, Card, CompareButton, Tag } from '../../styles/common'
import { formatMatchRate, getCalcState, toManWon } from '../../utils/recommend'
import LikeButton from '../common/LikeButton'
import LimitText from '../common/LimitText'
import Medal from '../common/Medal'
import MoneyText from '../common/MoneyText'
import RateText from '../common/RateText'
import Icon from '../ui/Icon'

const TOP_RANK = 3
const CALC_PATH = '/calc'

// 서버가 주는 판단 태그 중 '주의' 쪽 글 (나머지는 좋은 점). 명세서 be_recommend '추천 규칙' 판단 태그 줄의 주의 7개 (서버 RecommendRule.judgeTags가 만드는 글)
// TODO(RC-08): 서버가 judgeTags를 [{ text, level }]로 바꾸면 이 목록을 지우고 level로 색을 정함.
//   서버보다 먼저 바꾸지 말 것 (지금 서버는 글자 배열이라 객체로 그리면 화면이 깨짐). 서버와 같은 때에 바꿈
const WARN_TAGS = [
  '용도 확인 필요',
  '신용 구간 주의',
  '연령 조건 있음',
  '소득 조건 있음',
  '한도 확인 필요',
  '월 부담 큼',
  '연체 주의',
]

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

// 맨 윗줄: 메달 + 순위 + 추천도 (오른쪽 끝에 찜 버튼 자리). 아래 상품명과 가깝게 붙임
const Top = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: -6px;
`

// 찜 버튼 자리: 맨 윗줄 오른쪽 끝. 안에 LikeButton (CM-06)
const LikeSpot = styled.div`
  margin-left: auto;
`

const RankText = styled.b`
  font-size: var(--fs-md);
  font-weight: 800;
`

// 추천도: 주황 알약
const MatchRate = styled.span`
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand-text);
  font-size: var(--fs-xs);
  font-weight: 800;
`

// 상품명이 위, 금융사 · 소분류가 아래. 카드에 마우스를 올리면 상품명 밑줄
const NameBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const Name = styled.span`
  font-size: var(--fs-xl);
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.4;
  text-align: left;
  ${Wrap}:hover & {
    text-decoration: underline;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 4px;
  }
`

const Org = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

// 지표 3개: 칸을 늘리지 않고 왼쪽부터 일정한 간격으로
const Metrics = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px 28px;

  @media (max-width: 899px) {
    gap: 12px 20px;
  }
`

const Metric = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
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
  font-size: var(--fs-h2);
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
  white-space: nowrap;

  @media (max-width: 899px) {
    font-size: var(--fs-h3);
  }

  @media (max-width: 420px) {
    font-size: var(--fs-h4);
  }
`

// 금리가 추정 값일 때 금리 아래에 붙는 딱지
const EstimatedTag = styled(Tag)`
  align-self: flex-start;
  margin-top: 4px;
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

// 버튼 줄: [이자 계산] [+ 비교]를 같은 폭, 같은 글자로 (금리가 없어 [이자 계산]이 숨으면 [+ 비교]가 한 줄 전체). 899px 이하는 글자를 줄이고 아이콘은 숨김 ('A 담음'의 X는 남김)
// [+ 비교]는 주황 (primary 버튼), 담긴 상품 ('A 담음')과 '비교 불가'는 outline 바탕으로 각자 모양을 유지. 글자는 primary의 큰 글자를 쓰지 않고 [이자 계산]과 같게 맞춤
const Actions = styled.div`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 8px;

  & > button {
    font-size: var(--fs-base);
    font-weight: 700;
  }

  @media (max-width: 899px) {
    gap: 6px;

    & > button {
      padding: 0 6px;
      font-size: var(--fs-sm);
    }

    & > button:not([aria-pressed='true']) [data-icon] {
      display: none;
    }
  }
`

const Note = styled.p`
  margin: 0;
  color: var(--muted);
  font-size: var(--fs-xs);
`

/*
    RC-08 추천 카드: 추천 상품 1개 요약
    - props: item (RecommendItemDTO: rankNo, product, matchRate, estRateMin, estRateMax, rateEstimated, monthlyPayment, calcNote, judgeTags)
    - 카드 아무 곳 클릭 (Enter) → 상품 상세 창 openProduct(id, 'recommend'). 별도 [상세 보기] 버튼은 없음
    - [이자 계산] → navigate('/calc', { state }) / 버튼 클릭은 카드 클릭으로 안 퍼지게 함
    - 계산기로 넘기는 값은 utils/recommend.js getCalcState
    - 판단 태그는 서버가 보낸 글 그대로, 순서도 그대로 (서버가 주의 먼저 정렬). 서버 글은 글자로만 출력 (E1)
    - 하트: LikeButton (CM-06. 비회원은 requireLogin, 클릭이 카드까지 안 퍼지게 LikeButton이 stopPropagation)
    - [+ 비교] (ST-04, CHORONG-47, CHORONG-82): 누르면 상세 창이 아니라 이 상품을 비교 화면에 넣고 바로 /compare로 이동 (useCompareStore.startCompare, 클릭이 카드까지 안 퍼지게 stopPropagation). (명세서와 달라 문서반영요청)
      비교 화면의 한 칸을 고르는 중이면 남겨 둔 상품은 'A 담음', 안 겹치는 상품은 '비교 불가'
    - 모양: 상품명 위 / 금융사 · 소분류(SECTOR 태그) 아래, 지표는 왼쪽부터 간격, 판단 태그는 체크(좋음), 느낌표(주의) 아이콘, 버튼 줄은 [이자 계산] [+ 비교] 1:1
    - 금리가 없으면 [이자 계산] 숨김, 월 상환이 없으면 '계산 불가', 만기일시만 있는 상품은 '월 이자' (서버 월 상환이 매달 이자만이므로)
    - 판단 태그: 서버가 글자 배열(RecommendItemDTO List<String>)로 줌. WARN_TAGS에 있는 글은 주의(노랑), 나머지는 좋은 점(초록)으로 색만 나눔
*/
function RecommendCard({ item }) {
  const { rankNo, product, matchRate, estRateMin, estRateMax, rateEstimated, monthlyPayment, calcNote } = item
  const judgeTags = item.judgeTags ?? []
  const navigate = useNavigate()
  const openProduct = useUiStore((state) => state.openProduct)
  const lastInput = useRecommendStore((state) => state.lastInput)
  const startCompare = useCompareStore((state) => state.startCompare)
  // 비교 화면의 한 칸을 고르러 나온 중이면 남겨 둔 상품은 'A 담음' / 그 상품과 용도, 상환 방식이 안 겹치면 '비교 불가'
  const pickLabel = useCompareStore((state) => getPickBaseSlot(state, product.productId))
  const isNo = useCompareStore((state) => {
    const base = getCompareBase(state)
    return base !== null && base.productId !== product.productId && getCompareBlock(base, product) !== null
  })

  const isTop = rankNo <= TOP_RANK
  const hasRate = estRateMin != null || estRateMax != null
  const calcState = getCalcState(item, lastInput)
  const sector = (product.tags ?? []).find((tag) => tag.tagType === 'SECTOR')?.tagValue

  const handleOpen = () => openProduct(product.productId, 'recommend')

  const handleKeyDown = (event) => {
    // 카드 안 버튼에서 누른 Enter는 그 버튼 몫
    if (event.key === 'Enter' && event.target === event.currentTarget) handleOpen()
  }

  const handleCalc = (event) => {
    event.stopPropagation()
    navigate(CALC_PATH, { state: calcState })
  }

  // 이 상품을 비교 화면에 넣고 바로 이동 (바로 넣을 수 없으면 startCompare가 알림이나 확인 팝업). 상세 창은 열지 않음
  const handleCompare = (event) => {
    event.stopPropagation()
    if (startCompare(product)) navigate('/compare')
  }

  return (
    <Wrap as="article" $isTop={isTop} role="button" tabIndex={0} onClick={handleOpen} onKeyDown={handleKeyDown}>
      <Top>
        {isTop && <Medal rank={rankNo} size={26} />}
        <RankText>추천 {rankNo}위</RankText>
        <MatchRate>추천도 {formatMatchRate(matchRate)}%</MatchRate>
        <LikeSpot>
          <LikeButton productId={product.productId} />
        </LikeSpot>
      </Top>

      <NameBox>
        <Name>{product.productName}</Name>
        <Org>
          {product.companyName}
          {sector && ` · ${sector}`}
        </Org>
      </NameBox>

      <Metrics>
        <Metric>
          <MetricLabel>예상 금리</MetricLabel>
          {hasRate ? (
            <>
              <MetricValue $isRate>
                <RateText min={estRateMin} max={estRateMax} hasFixedLabel unitTone="soft" />
              </MetricValue>
              {rateEstimated && <EstimatedTag>추정</EstimatedTag>}
            </>
          ) : (
            <Memo>금리는 기관 문의</Memo>
          )}
        </Metric>
        <Metric>
          <MetricLabel>최대 한도</MetricLabel>
          <MetricValue>
            <LimitText product={product} />
          </MetricValue>
        </Metric>
        <Metric>
          <MetricLabel>{calcState.repayMethod === 'BULLET' ? '월 이자' : '예상 월 상환'}</MetricLabel>
          {monthlyPayment == null ? (
            <Memo>계산 불가</Memo>
          ) : (
            <MetricValue>
              <MoneyText value={toManWon(monthlyPayment)} unitTone="muted" />
            </MetricValue>
          )}
        </Metric>
      </Metrics>

      {judgeTags.length > 0 && (
        <Tags>
          {judgeTags.map((tag, index) => {
            const isWarn = WARN_TAGS.includes(tag)
            return (
              <Tag key={`${tag}-${index}`} $variant={isWarn ? 'warn' : 'good'}>
                <Icon name={isWarn ? 'alert' : 'check'} size={13} />
                {tag}
              </Tag>
            )
          })}
        </Tags>
      )}

      <Actions>
        {hasRate && (
          <Button $variant="outline" $size="sm" onClick={handleCalc}>
            <Icon name="calc" size={16} />
            이자 계산
          </Button>
        )}
        <CompareButton
          $variant={pickLabel || isNo ? 'outline' : undefined}
          $size="sm"
          $state={pickLabel ? 'in' : isNo ? 'no' : undefined}
          aria-pressed={Boolean(pickLabel)}
          onClick={handleCompare}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {pickLabel ? `${pickLabel} 담음` : isNo ? '비교 불가' : '+ 비교'}
          {pickLabel && <Icon name="close" size={15} />}
        </CompareButton>
      </Actions>

      {calcNote && <Note>{calcNote}</Note>}
    </Wrap>
  )
}

export default RecommendCard
