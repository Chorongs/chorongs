import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import useCompareStore, { getCompareBlock, getTraySlot } from '../../store/useCompareStore'
import { useRecommendStore } from '../../store/useRecommendStore'
import useUiStore from '../../store/useUiStore'
import { Button, Card, CompareButton, IconButton, Tag } from '../../styles/common'
import { formatMatchRate, getCalcState, toManWon } from '../../utils/recommend'
import LimitText from '../common/LimitText'
import Medal from '../common/Medal'
import MoneyText from '../common/MoneyText'
import RateText from '../common/RateText'
import Icon from '../ui/Icon'

const TOP_RANK = 3
const CALC_PATH = '/calc'

// 서버가 주는 판단 태그 중 '주의' 쪽 글 (나머지는 좋은 점). 명세서 be_recommend '추천 규칙'의 판단 태그 줄(주의 7개, 좋은 점 7개)과 서버 RecommendRule.judgeTags와 같음
// TODO(RC-08, CHORONG-44 Jung-YoonB): 서버가 judgeTags를 [{ text, level }]로 바꾸면(명세서 확정 뒤 새 이슈) 이 목록을 지우고 level로 색을 정함.
//   바뀌기 전에 프론트만 먼저 바꾸지 말 것 (객체를 글자로 그리면 화면이 깨짐). 바뀌는 날 서버와 같이 맞출 것
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

// 맨 윗줄: 메달 + 순위 + 일치도 (오른쪽 끝에 찜 버튼 자리, 가안). 아래 상품명과 가깝게 붙임
const Top = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: -6px;
`

// 찜 버튼: 맨 윗줄 오른쪽 끝 (가안)
const LikeSpot = styled(IconButton)`
  margin-left: auto;
`

const RankText = styled.b`
  font-size: var(--fs-md);
  font-weight: 800;
`

// 일치도: 주황 알약 (가안)
const MatchRate = styled.span`
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand-text);
  font-size: var(--fs-xs);
  font-weight: 800;
`

// 상품명이 위, 금융사 · 소분류가 아래 (가안). 카드에 마우스를 올리면 상품명 밑줄
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

// 지표 3개: 칸을 늘리지 않고 왼쪽부터 일정한 간격으로 (가안)
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

// 버튼 줄: 상세 보기가 두 배 넓음 (가안, 모바일에서도 같음). 899px 이하는 글자를 줄이고 아이콘은 숨김
const Actions = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;

  @media (max-width: 899px) {
    gap: 6px;

    & > button {
      padding: 0 6px;
      font-size: var(--fs-sm);
    }

    & [data-icon] {
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
    - 카드 아무 곳 클릭 (Enter) → 상품 상세 창 openProduct(id, 'recommend')
    - [상세 보기] → 카드 클릭과 같음 (가안에 있는 버튼) / [이자 계산] → navigate('/calc', { state }) / 버튼 클릭은 카드 클릭으로 안 퍼지게 함
    - TODO(LY-01, CHORONG-49 김진석): /calc 계산기 화면은 계산기 이슈가 라우트를 추가해야 생김. 그 전에는 [이자 계산]이 '찾을 수 없음' 화면으로 감 (넘기는 값은 utils/recommend.js getCalcState)
    - 판단 태그는 서버가 보낸 글 그대로, 순서도 그대로 (서버가 주의 먼저 정렬). 서버 글은 글자로만 출력 (E1)
    - TODO(CM-06, CHORONG-43 Tong-B): 하트 버튼은 가안 모양과 자리만 있고 동작은 달지 않았음. LikeButton(찜 담기, 비회원은 requireLogin, 클릭이 카드까지 안 퍼지게 stopPropagation)으로 교체. 눌러도 반응이 없는 것에 대한 사용자 안내는 43이 시연 전 일괄 처리하기로 함
    - [+ 비교] (ST-04, CHORONG-47): 누르면 상세 창이 아니라 바로 비교함에 담음 (useCompareStore.addTray, 클릭이 카드까지 안 퍼지게 stopPropagation). 담긴 상품은 'A 담음', 비교함 첫 상품과 용도나 상환 방식이 안 맞으면 '비교 불가'. 안 맞는 상품은 눌러도 안 담기고 알림 (addTray)
    - 모양은 가안(cashlink_21.html .rec.rc): 상품명 위 / 금융사 · 소분류(SECTOR 태그) 아래, 지표는 왼쪽부터 간격, 판단 태그는 체크(좋음), 느낌표(주의) 아이콘, 버튼 줄은 2:1:1
    - 금리가 없으면 [이자 계산] 숨김, 월 상환이 없으면 '계산 불가', 만기일시만 있는 상품은 '월 이자' (서버 월 상환이 매달 이자만이므로)
    - 판단 태그: 서버가 글자 배열(List<String>)로 줌 (RecommendItemDTO 확인함). WARN_TAGS에 있는 글은 주의(노랑), 나머지는 좋은 점(초록)으로 색만 나눔
*/
function RecommendCard({ item }) {
  const { rankNo, product, matchRate, estRateMin, estRateMax, rateEstimated, monthlyPayment, calcNote } = item
  const judgeTags = item.judgeTags ?? []
  const navigate = useNavigate()
  const openProduct = useUiStore((state) => state.openProduct)
  const lastInput = useRecommendStore((state) => state.lastInput)
  const addTray = useCompareStore((state) => state.addTray)
  // 비교함에서 A, B 어느 칸인지 (없으면 null) / 비교함 첫 상품과 용도나 상환 방식이 안 겹치면 '비교 불가'
  const traySlot = useCompareStore((state) => getTraySlot(state.tray, state.swapSlot, product.productId))
  const isNo = useCompareStore(
    (state) =>
      state.tray.length > 0 &&
      !state.tray.some((trayItem) => trayItem.productId === product.productId) &&
      getCompareBlock(state.tray[0], product) !== null,
  )

  const isTop = rankNo <= TOP_RANK
  const hasRate = estRateMin != null || estRateMax != null
  const calcState = getCalcState(item, lastInput)
  const sector = (product.tags ?? []).find((tag) => tag.tagType === 'SECTOR')?.tagValue

  const handleOpen = () => openProduct(product.productId, 'recommend')

  const handleKeyDown = (event) => {
    // 카드 안 버튼에서 누른 Enter는 그 버튼 몫
    if (event.key === 'Enter' && event.target === event.currentTarget) handleOpen()
  }

  const handleOpenClick = (event) => {
    event.stopPropagation()
    handleOpen()
  }

  const handleCalc = (event) => {
    event.stopPropagation()
    navigate(CALC_PATH, { state: calcState })
  }

  // 이미 담긴 상품이면 빼기. 안 맞는 상품이면 addTray가 이유를 알림. 상세 창은 열지 않음
  const handleCompare = (event) => {
    event.stopPropagation()
    addTray(product)
  }

  return (
    <Wrap as="article" $isTop={isTop} role="button" tabIndex={0} onClick={handleOpen} onKeyDown={handleKeyDown}>
      <Top>
        {isTop && <Medal rank={rankNo} size={26} />}
        <RankText>추천 {rankNo}위</RankText>
        <MatchRate>일치도 {formatMatchRate(matchRate)}%</MatchRate>
        <LikeSpot aria-label={`${product.productName} 찜하기`}>
          <Icon name="heart" />
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
        <Button $size="sm" onClick={handleOpenClick}>
          상세 보기
        </Button>
        {hasRate && (
          <Button $variant="outline" $size="sm" onClick={handleCalc}>
            <Icon name="calc" size={16} />
            이자 계산
          </Button>
        )}
        <CompareButton
          $variant="outline"
          $size="sm"
          $state={traySlot ? 'in' : isNo ? 'no' : undefined}
          aria-pressed={Boolean(traySlot)}
          onClick={handleCompare}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {traySlot && <Icon name="check" size={15} />}
          {traySlot ? `${traySlot} 담음` : isNo ? '비교 불가' : '+ 비교'}
        </CompareButton>
      </Actions>

      {calcNote && <Note>{calcNote}</Note>}
    </Wrap>
  )
}

export default RecommendCard
