import styled from 'styled-components'
import MoneyText from './MoneyText'

// CM-12 한도 글자: 상품 한도 한 칸 (상품 한 줄, 추천 카드가 같이 씀)
// product: ProductSummaryDTO (limitAmount, tags)
// 한도가 숫자면 금액, 숫자가 아니면 종류 글 (한도 제한 없음, 심사 후 결정 등: tags의 AMOUNT), 그것도 없으면 '기관 문의'
const Memo = styled.span`
  color: var(--cocoa);
  font-family: var(--f-ui);
  font-size: var(--fs-sm);
  font-weight: 700;
`

function LimitText({ product }) {
  if (typeof product.limitAmount === 'number') return <MoneyText value={product.limitAmount} unitTone="muted" />
  const amountTag = (product.tags ?? []).find((tag) => tag.tagType === 'AMOUNT')
  return <Memo>{amountTag?.tagValue ?? '기관 문의'}</Memo>
}

export default LimitText
