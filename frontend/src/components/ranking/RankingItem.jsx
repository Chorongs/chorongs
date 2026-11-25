import styled, { css } from 'styled-components'
import { FEATURE_LABEL } from '../../constants/options'
import useUiStore from '../../store/useUiStore'
import { Num, Tag, Unit } from '../../styles/common'
import { formatNumber, formatPrepayFee, formatRate, formatTagValues } from '../../utils/format'
import LimitText from '../common/LimitText'
import Medal from '../common/Medal'
import MoneyText from '../common/MoneyText'
import RateText from '../common/RateText'

// RK-02 순위 한 줄 (가안 .rk): 순위 / 금융사, 상품명, 태그 2개 (상품 특징 앞 2개) / 기준 값 / 보조 값
// 1~3위: 순위 자리에 메달 + 주황 테두리 카드(2px --brand) + 아래 연회색 칸 (신청 대상, 금리 범위, 상환 방식, 중도상환수수료)
// 줄 아무 곳 클릭, Enter(Space) → 상품 상세 창 (openProduct(id, 'ranking')). 줄 안에 다른 버튼이 없어 줄 자체를 role="button"으로 둠 (가안과 같게)
// item: { rankNo, product (ProductSummaryDTO), prepayFeeMax, metricValue } / metric: rate, limit, term, views (기준 값 모양을 정함)
// 서버 글은 글자로만 출력 (E1). 숨김 상품은 나머지 칸이 null이라 빈 값은 '-'로 보여 줌
// 기준 값 이름표: 금리순 '최저 금리', 한도순 '최대 한도', 기간순 '최대 기간', 인기순 '조회수' (명세서 글) / 보조 값: 금리순이면 '최대 한도', 나머지는 '최저 금리' (가안과 같게)
const METRIC_LABEL = { rate: '최저 금리', limit: '최대 한도', term: '최대 기간', views: '조회수' }
const TOP_RANK = 3
const TARGET_SHOWN_MAX = 3 // 신청 대상은 3개까지, 나머지는 '외 N'

const Item = styled.article.attrs({ role: 'button', tabIndex: 0 })`
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 128px 128px;
  gap: 16px;
  align-items: center;
  padding: 22px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  ${({ $isTop }) =>
    $isTop &&
    css`
      margin-bottom: 8px;
      padding: 21px;
      border: 2px solid var(--brand);
      border-radius: var(--r-md);
      background: var(--paper);
      row-gap: 16px;
    `}
  @media (max-width: 899px) {
    grid-template-columns: 30px minmax(0, 1fr) auto;
    gap: 4px 12px;
    padding: 18px;
    ${({ $isTop }) =>
      $isTop &&
      css`
        row-gap: 12px;
        padding: 17px;
      `}
  }
`

const RankCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--ink);
  font-family: var(--f-num);
  font-size: var(--fs-h4);
  font-weight: 900;
  line-height: 1;
  text-align: center;
  @media (max-width: 899px) {
    grid-row: 1 / span 2;
    svg {
      width: 26px;
      height: 26px;
    }
  }
`

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const Org = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

// 상품명 (1~3위는 한 단계 크게). 줄 위에 마우스를 올리면 밑줄
const Name = styled.span`
  color: var(--ink);
  font-size: ${({ $isTop }) => ($isTop ? 'var(--fs-xl)' : 'var(--fs-lg)')};
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.4;
  ${Item}:hover & {
    text-decoration: underline;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 4px;
  }
`

const Tags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
`

// 기준 값 칸 ($isMain) / 보조 값 칸: 숫자 크기는 --fs-h3, 보조 값은 연한 글자색
const Metric = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  @media (max-width: 899px) {
    ${({ $isMain }) =>
      $isMain
        ? css`
            grid-column: 3;
            grid-row: 1 / span 2;
            align-items: flex-end;
          `
        : css`
            grid-column: 2;
            grid-row: 2;
            flex-direction: row;
            gap: 6px;
            align-items: baseline;
          `}
  }
`

const MetricLabel = styled.span`
  margin-bottom: 1px;
  color: var(--cocoa);
  font-size: var(--fs-xs);
  font-weight: 600;
  @media (max-width: 899px) {
    ${({ $isMain }) =>
      !$isMain &&
      css`
        margin: 0;
      `}
  }
`

const MetricValue = styled.b`
  color: ${({ $tone }) => ($tone === 'brand' ? 'var(--brand-text)' : $tone === 'dim' ? 'var(--ink-2)' : 'inherit')};
  font-family: var(--f-num);
  font-size: var(--fs-h3);
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.25;
  white-space: nowrap;
  @media (max-width: 899px) {
    font-size: ${({ $isMain }) => ($isMain ? 'var(--fs-h4)' : 'var(--fs-base)')};
  }
`

const Memo = styled.span`
  color: var(--cocoa);
  font-family: var(--f-ui);
  font-size: var(--fs-sm);
  font-weight: 700;
`

// 1~3위 연회색 칸: 2열 (모바일 1열), 칸 이름 폭 92
const Detail = styled.dl`
  grid-column: 2 / -1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 20px;
  margin: 0;
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--mist);
  div {
    display: flex;
    gap: 12px;
    min-width: 0;
    font-size: var(--fs-sm);
    line-height: 1.5;
  }
  dt {
    flex: none;
    width: 92px;
    color: var(--cocoa);
    font-weight: 700;
  }
  dd {
    min-width: 0;
    margin: 0;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }
  @media (max-width: 899px) {
    grid-column: 1 / -1;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    dt {
      width: 88px;
    }
  }
`

// 기준 값 (rate 연 %, limit 만원, term 개월, views 조회수). 값이 없으면 '-'
function MetricText({ metric, value }) {
  if (value === null || value === undefined) return <Num $weight={800}>-</Num>
  if (metric === 'rate') return <RateText value={value} unitTone="soft" />
  if (metric === 'limit') return <MoneyText value={value} unitTone="muted" />
  return (
    <Num $weight={800}>
      {formatNumber(value)}
      <Unit $size="sm" $tone="muted">
        {metric === 'term' ? '개월' : '회'}
      </Unit>
    </Num>
  )
}

// 보조 값: 금리순이면 최대 한도, 나머지는 최저 금리
function SubValue({ metric, product }) {
  if (metric === 'rate') return <LimitText product={product} />
  if (product.rateMin === null || product.rateMin === undefined) return <Memo>기관 문의</Memo>
  return <RateText value={product.rateMin} unitTone="muted" />
}

// 신청 대상: 3개까지 쉼표로, 더 있으면 '외 N' / 금리 범위: '연 4.50~9.80%'
function getTargetText(product) {
  const targets = (product.tags ?? []).filter((tag) => tag.tagType === 'TARGET').map((tag) => tag.tagValue)
  if (targets.length === 0) return '정보 없음'
  const shown = targets.slice(0, TARGET_SHOWN_MAX).join(', ')
  return targets.length > TARGET_SHOWN_MAX ? `${shown} 외 ${targets.length - TARGET_SHOWN_MAX}` : shown
}

function getRateRangeText({ rateMin, rateMax }) {
  if (rateMin == null && rateMax == null) return '기관 문의'
  const low = formatRate(rateMin ?? rateMax)
  const high = formatRate(rateMax ?? rateMin)
  return low === high ? `연 ${low}%` : `연 ${low}~${high}%`
}

function RankingItem({ item, metric }) {
  const openProduct = useUiStore((state) => state.openProduct)
  const { rankNo, product, prepayFeeMax, metricValue } = item
  const isTop = rankNo <= TOP_RANK
  const featureTags = (product.features ?? []).slice(0, 2)

  const handleOpen = () => openProduct(product.productId, 'ranking')

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleOpen()
  }

  return (
    <Item
      $isTop={isTop}
      aria-label={`${rankNo}위 ${product.companyName} ${product.productName} 상세 보기`}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <RankCell>{isTop ? <Medal rank={rankNo} size={30} /> : rankNo}</RankCell>
      <Info>
        <Org>{product.companyName}</Org>
        <Name $isTop={isTop}>{product.productName}</Name>
        {featureTags.length > 0 && (
          <Tags>
            {featureTags.map((code) => (
              <Tag key={code}>{FEATURE_LABEL[code] ?? code}</Tag>
            ))}
          </Tags>
        )}
      </Info>
      <Metric $isMain>
        <MetricLabel $isMain>{METRIC_LABEL[metric]}</MetricLabel>
        <MetricValue $isMain $tone={metric === 'rate' ? 'brand' : undefined}>
          <MetricText metric={metric} value={metricValue} />
        </MetricValue>
      </Metric>
      <Metric>
        <MetricLabel>{metric === 'rate' ? METRIC_LABEL.limit : METRIC_LABEL.rate}</MetricLabel>
        <MetricValue $tone="dim">
          <SubValue metric={metric} product={product} />
        </MetricValue>
      </Metric>
      {isTop && (
        <Detail>
          <div>
            <dt>신청 대상</dt>
            <dd>{getTargetText(product)}</dd>
          </div>
          <div>
            <dt>금리 범위</dt>
            <dd>{getRateRangeText(product)}</dd>
          </div>
          <div>
            <dt>상환 방식</dt>
            <dd>{formatTagValues(product, 'REPAY')}</dd>
          </div>
          <div>
            <dt>중도상환수수료</dt>
            <dd>{formatPrepayFee(prepayFeeMax)}</dd>
          </div>
        </Detail>
      )}
    </Item>
  )
}

export default RankingItem
