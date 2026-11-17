import styled from 'styled-components'
import { Button, EmptyBox } from '../../styles/common'
import ProductRow from './ProductRow'

// CM-05 상품 목록: ProductRow 반복 / 빈 상태 (목록이 있을 때와 같은 자리)
// items: ProductSummaryDTO 목록 (key는 상품 번호) / from: 상세 창을 어디서 열었는지 ('recommend' 또는 생략)
// 많으면 page, size로 나눠 받는다 (E7): 받는 일은 부르는 쪽이 하고, 여기서는 [더 보기]만 그린다.
// hasMore: 더 받을 쪽이 있음 / onMore: [더 보기] 누름 / isMoreLoading: 받는 중이면 버튼 잠금 (E5)
// 목록 폭이 줄 모양을 정한다: ProductRow가 이 목록(plist)의 폭 720, 480 이하에서 바뀜
const List = styled.ul`
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line);
  container-type: inline-size;
  container-name: plist;
`

const More = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 20px;
`

function ProductList({
  items = [],
  from = null,
  emptyText = '조건에 맞는 상품이 없어요',
  hasMore = false,
  onMore,
  isMoreLoading = false,
}) {
  if (items.length === 0) return <EmptyBox>{emptyText}</EmptyBox>

  return (
    <>
      <List>
        {items.map((product) => (
          <li key={product.productId}>
            <ProductRow product={product} from={from} />
          </li>
        ))}
      </List>
      {hasMore && (
        <More>
          <Button $variant="outline" onClick={onMore} disabled={isMoreLoading}>
            {isMoreLoading ? '불러오는 중' : '더 보기'}
          </Button>
        </More>
      )}
    </>
  )
}

export default ProductList
