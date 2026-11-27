import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { FEATURE_LABEL } from '../../constants/options'
import useCompareStore, { getPurposes } from '../../store/useCompareStore'
import useUiStore from '../../store/useUiStore'
import { Button, EmptyBox, IconButton, SlotBadge, Tag } from '../../styles/common'
import { formatMoney, formatPrepayFee, formatRange, formatRateRange, formatTagValues } from '../../utils/format'
import { getMidRate, getRepayCode, getSupportedMethods } from '../../utils/loanMath'
import MoneyText from '../common/MoneyText'
import RateText from '../common/RateText'
import Icon from '../ui/Icon'

// CP-03 비교 카드: 상품 요약 카드 (A 또는 B 칸). 모양은 시안과 같게: A는 주황, B는 파랑 테두리
// [이자 계산] → 벗어나기 확인 창을 거쳐 계산기(/calc)에 금액(원), 기간, 금리 중간값, 고른 상환 방식 코드를 넘김 (상세 창 안 열고 바로 연결)
// [다른 상품으로 비교] → 이 칸의 상품을 바꾸러 항상 상품 찾기의 상세 검색(/search)으로 (반대 칸 상품은 그대로) / X → 이 칸만 빈 칸
// 숨김 상품은 상세 없이 '지금은 볼 수 없는 상품' 안내. 한도, 기간을 넘으면 경고. 금리 기관 문의 상품은 [이자 계산] 대신 안내 글
// isSummary: 상대 칸이 비어 있어 아직 비교 못 할 때 쓰는 간단한 카드 (자금 용도, 금리 한 줄 + [빼기])
const Wrap = styled.article`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: ${({ $isSummary }) => ($isSummary ? '260px' : 'auto')};
  padding: 22px;
  border: 1px solid ${({ $slot }) => ($slot === 'B' ? 'var(--viz-1)' : 'var(--viz-2)')};
  border-radius: var(--r-md);
  background: var(--paper);
  box-shadow: 0 0 0 1px ${({ $slot }) => ($slot === 'B' ? 'var(--viz-1)' : 'var(--viz-2)')};
  justify-content: ${({ $isSummary }) => ($isSummary ? 'center' : 'flex-start')};
  @media (max-width: 899px) {
    min-height: ${({ $isSummary }) => ($isSummary ? '200px' : 'auto')};
  }
`

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  @media (max-width: 899px) {
    flex-wrap: wrap;
  }
`

const HeadInfo = styled.div`
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  @media (max-width: 899px) {
    flex: 1 1 calc(100% - 48px);
  }
`

const Org = styled.span`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const Name = styled.h3`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: var(--fs-xl);
  font-weight: 800;
  line-height: 1.35;
  word-break: keep-all;
  overflow-wrap: anywhere;
`

// X는 이름 길이와 상관없이 카드 오른쪽 위에 고정
const RemoveIcon = styled(IconButton)`
  flex: none;
  align-self: flex-start;
  margin-left: auto;
`

const Over = styled.p`
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--bad-soft);
  color: var(--ink-2);
  font-size: var(--fs-sm);
  line-height: 1.5;
  b {
    color: var(--bad);
  }
  svg,
  [data-icon] {
    flex: none;
    margin-top: 4px;
    color: var(--bad);
  }
`

const Numbers = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  /* 항목 이름(small)만 위 줄에. 값 안의 단위(만원, %)도 small이라 범위를 좁혀야 줄이 안 바뀜 */
  & > div > small {
    display: block;
    color: var(--cocoa);
    font-size: var(--fs-xs);
    font-weight: 600;
  }
  b {
    font-family: var(--f-num);
    font-size: var(--fs-base);
    font-weight: 800;
  }
`

const RateValue = styled.b`
  color: var(--brand-text);
`

const Memo = styled.span`
  font-family: var(--f-ui);
  font-size: var(--fs-sm);
  font-weight: 700;
`

const List = styled.dl`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 8px 16px;
  margin: 0;
  font-size: var(--fs-sm);
  dt {
    color: var(--cocoa);
    font-weight: 600;
  }
  dd {
    margin: 0;
    color: var(--ink);
    font-weight: 700;
    word-break: keep-all;
  }
`

const Hint = styled.p`
  color: var(--cocoa);
  font-size: var(--fs-sm);
  line-height: 1.55;
`

// 카드 맨 아래 버튼 줄: [이자 계산] 옆에 [다른 상품으로 비교]
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
`


function getLimitCell(product) {
  if (typeof product.limitAmount === 'number') return <MoneyText value={product.limitAmount} weight={800} />
  const amountTag = (product.tags ?? []).find((tag) => tag.tagType === 'AMOUNT')
  return <Memo>{amountTag?.tagValue ?? '기관 문의'}</Memo>
}


function CompareCard({ slot, product, otherProduct = null, amountMan, months, method, isSummary = false }) {
  const navigate = useNavigate()
  const clearSlot = useCompareStore((state) => state.clearSlot)
  const setPickSlot = useCompareStore((state) => state.setPickSlot)
  const openCompareLeave = useUiStore((state) => state.openCompareLeave)
  const sector = formatTagValues(product, 'SECTOR')

  const info = (
    <HeadInfo>
      <Org>{sector === '정보 없음' ? product.companyName : `${product.companyName} · ${sector}`}</Org>
      <Name>
        {product.productName}
        {product.productStatus === 'CLOSED' && <Tag $variant="warn">판매 종료</Tag>}
      </Name>
    </HeadInfo>
  )

  // 숨김 상품: 상세 없이 안내만 (계산, 유리 판정에서도 뺌)
  if (product.productStatus === 'HIDDEN') {
    return (
      <Wrap $slot={slot} $isSummary={isSummary}>
        <Head>
          <SlotBadge $slot={slot}>{slot}</SlotBadge>
          {info}
          <RemoveIcon aria-label={`${slot} 상품 빼기`} title="비교에서 빼기" onClick={() => clearSlot(slot)}>
            <Icon name="close" />
          </RemoveIcon>
        </Head>
        <EmptyBox>지금은 볼 수 없는 상품이에요</EmptyBox>
      </Wrap>
    )
  }

  // 상대 칸이 비어 있을 때: 간단한 카드
  if (isSummary) {
    return (
      <Wrap $slot={slot} $isSummary>
        <Head>
          <SlotBadge $slot={slot}>{slot}</SlotBadge>
          {info}
          <Button $size="sm" $variant="outline" onClick={() => clearSlot(slot)}>
            <Icon name="close" size={16} />
            빼기
          </Button>
        </Head>
        <Hint>
          자금 용도 {getPurposes(product).join('·') || '정보 없음'} · 금리 {formatRateRange(product.rateMin, product.rateMax)}
        </Hint>
      </Wrap>
    )
  }

  const midRate = getMidRate(product.rateMin, product.rateMax)
  const isOverLimit = typeof product.limitAmount === 'number' && amountMan > product.limitAmount
  const isOverTerm = typeof product.termMax === 'number' && product.termMax > 0 && months > product.termMax
  const overLabels = [isOverLimit && '한도 초과', isOverTerm && '기간 초과'].filter(Boolean)
  const maxParts = [
    typeof product.limitAmount === 'number' && formatMoney(product.limitAmount),
    typeof product.termMax === 'number' && product.termMax > 0 && `${product.termMax}개월`,
  ].filter(Boolean)
  const features = (product.features ?? []).map((code) => FEATURE_LABEL[code] ?? code)
  const hasAge = product.ageMin != null || product.ageMax != null

  // 계산기로 넘기는 상환 방식: 비교 화면에서 고른 방식 (이 상품이 지원 안 하면 그 상품의 첫 방식)
  const repayMethod = method && getSupportedMethods(product).includes(method) ? method : getRepayCode(product)

  // 계산기로 가면 대출 비교를 벗어나므로 먼저 확인 창 ([예]를 누르면 값을 넘기며 이동)
  const handleCalc = () =>
    openCompareLeave('/calc', { loanAmount: amountMan * 10000, loanMonths: months, interestRate: midRate, repayMethod })

  // 이 칸의 상품을 바꾸러 감: 반대 칸 상품(otherProduct)은 제자리에 두고, 거기서 [+ 비교]를 누른 상품이 이 칸에 들어가 비교 화면으로 되돌아옴
  // 반대 칸 상품은 용도, 상환 방식이 겹치는 상품만 보이게 거르는 기준 (숨김 상품이면 기준 없음)
  const handleSwap = () => {
    setPickSlot(slot, otherProduct?.productStatus === 'HIDDEN' ? null : otherProduct)
    navigate('/search')
  }

  return (
    <Wrap $slot={slot}>
      <Head>
        <SlotBadge $slot={slot}>{slot}</SlotBadge>
        {info}
        <RemoveIcon aria-label={`${product.productName} 비교에서 빼기`} title="비교에서 빼기" onClick={() => clearSlot(slot)}>
          <Icon name="close" />
        </RemoveIcon>
      </Head>
      {overLabels.length > 0 && (
        <Over role="alert">
          <Icon name="alert" size={16} />
          <span>
            <b>{overLabels.join(' · ')}</b> · 입력한 {formatMoney(amountMan)} · {months}개월이 이 상품의 최대{' '}
            {maxParts.join(' · ')}을 넘어서 월 상환액과 총이자는 계산할 수 없어요.
          </span>
        </Over>
      )}
      <Numbers>
        <div>
          <small>금리 (연)</small>
          <RateValue>
            {midRate === null ? (
              <Memo>금리는 기관 문의</Memo>
            ) : (
              <RateText min={product.rateMin} max={product.rateMax} hasFixedLabel unitSize="xs" />
            )}
          </RateValue>
        </div>
        <div>
          <small>최대 한도</small>
          <b>{getLimitCell(product)}</b>
        </div>
        <div>
          <small>최대 기간</small>
          <b>{typeof product.termMax === 'number' && product.termMax > 0 ? `${product.termMax}개월` : '정보 없음'}</b>
        </div>
      </Numbers>
      <List>
        <dt>상환 방식</dt>
        <dd>{formatTagValues(product, 'REPAY')}</dd>
        <dt>중도상환수수료</dt>
        <dd>{formatPrepayFee(product.prepayFeeMax)}</dd>
        <dt>신청 대상</dt>
        <dd>{formatTagValues(product, 'TARGET')}</dd>
        {hasAge && (
          <>
            <dt>나이 조건</dt>
            <dd>{formatRange(product.ageMin, product.ageMax, '만 ', '세')}</dd>
          </>
        )}
        <dt>자금 용도</dt>
        <dd>{formatTagValues(product, 'PURPOSE')}</dd>
        <dt>신용점수 기준</dt>
        <dd>{formatRange(product.creditMin, product.creditMax, '', '점')}</dd>
        <dt>특징</dt>
        <dd>{features.length > 0 ? features.join(', ') : '-'}</dd>
      </List>
      {midRate === null && <Hint>금리는 신청하는 곳에서 안내해요. 이자 계산은 할 수 없어요.</Hint>}
      <Actions>
        {midRate !== null && (
          <Button $size="sm" $variant="outline" onClick={handleCalc}>
            <Icon name="calc" size={16} />
            이자 계산
          </Button>
        )}
        <Button $size="sm" $variant="outline" onClick={handleSwap}>
          다른 상품으로 비교
        </Button>
      </Actions>
    </Wrap>
  )
}

export default CompareCard
