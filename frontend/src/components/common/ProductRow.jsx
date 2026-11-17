import { useLocation } from 'react-router-dom'
import styled, { css } from 'styled-components'
import { FEATURE_LABEL } from '../../constants/options'
import useCompareStore, { getComparePage, getCompareBlock, getTraySlot } from '../../store/useCompareStore'
import useUiStore from '../../store/useUiStore'
import { CompareButton, Tag } from '../../styles/common'
import Icon from '../ui/Icon'
import MoneyText from './MoneyText'
import RateText from './RateText'

// CM-04 상품 한 줄: 금융사 / 상품명 / 태그 2개 (상품 특징 앞 2개) / 금리 / 한도
// 줄 아무 곳 클릭, Enter → 상품 상세 창 (from: 추천에서 열면 'recommend')
// 줄 모양은 시안과 같게: 카드 없이 아래 구분선만, 목록(ProductList) 폭 720 이하에서 2줄 배치 (container query)
// TODO(CM-06, CHORONG-43): 찜 버튼 LikeButton 연결 (클릭이 줄까지 안 퍼지게 e.stopPropagation)
// [+ 비교] (CM-09 비교함): 맞춤 추천, 상품 찾기 화면에서만 보인다. (랭킹 등 다른 화면에서는 비교 안 함) 폭 480 이하에서는 숨김
//   오른쪽에 맞춤 칸(auto)을 하나 더 두고, 720 이하에서는 3열(1fr 1fr auto)의 1행 오른쪽으로 보낸다. (시안과 같게)
//   담긴 상품: 줄에 연주황 바탕 + '비교 A에 담음' 딱지, 버튼은 'A 담음' / 비교함 첫 상품과 용도나 상환 방식이 안 겹치는 상품: 줄을 흐리게 + '비교 불가'
const Row = styled.article`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 168px 128px${({ $hasCompare }) => ($hasCompare ? ' auto' : '')};
  gap: 20px;
  align-items: center;
  padding: 20px 2px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  ${({ $isInCmp }) =>
    $isInCmp &&
    css`
      margin: 6px -16px;
      padding: 20px 16px;
      border-radius: var(--r-md);
      border-bottom-color: transparent;
      background: var(--brand-soft);
    `}
  ${({ $isNo }) =>
    $isNo &&
    css`
      & > :not([data-compare-cell]) {
        opacity: 0.5;
      }
    `}
  @container plist (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)${({ $hasCompare }) => ($hasCompare ? ' auto' : '')};
    gap: 2px 12px;
    align-items: start;
    padding: 18px 0;
    ${({ $isInCmp }) =>
      $isInCmp &&
      css`
        margin: 6px -10px;
        padding: 16px 10px;
      `}
  }
  @container plist (max-width: 480px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
`

const Info = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  @container plist (max-width: 720px) {
    grid-column: 1 / -1;
    grid-row: 1;
  }
`

const Org = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
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

const CompareCell = styled.div`
  @container plist (max-width: 720px) {
    grid-row: 1;
    grid-column: 3;
  }
  @container plist (max-width: 480px) {
    display: none;
  }
`

const CompareBadge = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: var(--r-pill);
  background: var(--brand);
  color: #fff;
  font-size: var(--fs-2xs);
  font-weight: 800;
  vertical-align: 1px;
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

// 한도가 숫자가 아니면 종류 글 (한도 제한 없음, 심사 후 결정 등), 그것도 없으면 '기관 문의'
function LimitCell({ product }) {
  if (typeof product.limitAmount === 'number') return <MoneyText value={product.limitAmount} unitTone="muted" />
  const amountTag = (product.tags ?? []).find((tag) => tag.tagType === 'AMOUNT')
  return <Memo>{amountTag?.tagValue ?? '기관 문의'}</Memo>
}

// 중도상환수수료 없음, 정부/서민 지원은 주황 딱지로 눈에 띄게
const ACCENT_FEATURES = ['NO_PREPAY_FEE', 'POLICY']

function ProductRow({ product, from = null }) {
  const openProduct = useUiStore((state) => state.openProduct)
  const { pathname } = useLocation()
  // 비교함에서 A, B 어느 칸인지 (없으면 null) / 비교함 첫 상품과 자금 용도가 안 겹치면 '비교 불가'
  const trayLabel = useCompareStore((state) => getTraySlot(state.tray, state.swapSlot, product.productId))
  const isNo = useCompareStore((state) => state.tray.length > 0 && !state.tray.some((item) => item.productId === product.productId) && getCompareBlock(state.tray[0], product) !== null)
  const addTray = useCompareStore((state) => state.addTray)
  const hasCompare = getComparePage(pathname) !== null && product.productStatus === 'ON'
  // 비교 안 하는 화면(랭킹 등)에서는 담긴 표시도 안 함
  const traySlot = hasCompare ? trayLabel : null
  const featureTags = (product.features ?? []).slice(0, 2)

  const handleOpen = () => openProduct(product.productId, from)

  // 이미 담긴 상품이면 빼기. 안 맞는 상품이면 addTray가 이유를 알림. 클릭이 줄(상세 창 열기)까지 안 퍼지게 한다.
  const handleCompare = (event) => {
    event.stopPropagation()
    addTray(product)
  }

  const handleKeyDown = (event) => {
    // 줄 안의 버튼에서 누른 Enter는 그 버튼 몫
    if (event.key === 'Enter' && event.target === event.currentTarget) handleOpen()
  }

  return (
    <Row
      role="button"
      tabIndex={0}
      $hasCompare={hasCompare}
      $isInCmp={Boolean(traySlot)}
      $isNo={hasCompare && isNo}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <Info>
        <Org>
          {product.companyName}
          {traySlot && <CompareBadge>비교 {traySlot}에 담음</CompareBadge>}
        </Org>
        <Name>{product.productName}</Name>
        {featureTags.length > 0 && (
          <Tags>
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
          <LimitCell product={product} />
        </MetricValue>
      </Metric>
      {hasCompare && (
        <CompareCell data-compare-cell>
          <CompareButton
            $size="sm"
            $variant="outline"
            $state={traySlot ? 'in' : isNo ? 'no' : undefined}
            aria-pressed={Boolean(traySlot)}
            onClick={handleCompare}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {traySlot && <Icon name="check" size={15} />}
            {traySlot ? `${traySlot} 담음` : isNo ? '비교 불가' : '+ 비교'}
          </CompareButton>
        </CompareCell>
      )}
    </Row>
  )
}

export default ProductRow
