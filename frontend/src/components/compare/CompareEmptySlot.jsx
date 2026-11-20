import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import useCompareStore, { getPurposes } from '../../store/useCompareStore'
import { Button, SlotBadge } from '../../styles/common'
import Icon from '../ui/Icon'

// CP-04 빈 비교 칸: 상품 없는 칸 (점선 카드, 시안과 같게)
// [비교 상품 고르기] → 상품 찾기로. 남은 상품이 있으면 그 상품 자금 용도로 필터, 없으면 비교함 비우고 조건 초기화
const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 260px;
  padding: 28px 20px;
  border: 1px dashed var(--line-2);
  border-radius: var(--r-lg);
  background: var(--paper);
  color: var(--cocoa);
  text-align: center;
  @media (max-width: 899px) {
    min-height: 200px;
  }
`

const Title = styled.b`
  margin-top: 4px;
  color: var(--ink);
  font-size: var(--fs-h4);
  font-weight: 900;
`

const Hint = styled.p`
  font-size: var(--fs-sm);
  line-height: 1.55;
`

const PickButton = styled(Button)`
  margin-top: 8px;
`

// slot: 'A' 또는 'B' (이 빈 칸) / keepProduct: 남은 상품 상세 (없거나 숨김 상품이면 null)
function CompareEmptySlot({ slot, keepProduct = null }) {
  const navigate = useNavigate()
  const startSwap = useCompareStore((state) => state.startSwap)
  const clearTray = useCompareStore((state) => state.clearTray)

  const handlePick = () => {
    if (keepProduct) startSwap(slot, keepProduct)
    else clearTray()
    navigate('/search')
  }

  return (
    <Wrap>
      <SlotBadge $slot={slot}>{slot}</SlotBadge>
      <Title>텅~ 비어 있어요</Title>
      {keepProduct ? (
        <Hint>
          {keepProduct.productName} 상품과 자금 용도
          <br />({getPurposes(keepProduct).join('·')})가 겹치는 상품을 골라 주세요.
        </Hint>
      ) : (
        <Hint>
          상품 찾기에서 [+ 비교]를 눌러
          <br />
          비교할 상품을 담아 주세요.
        </Hint>
      )}
      <PickButton $variant="outline" onClick={handlePick}>
        <Icon name="search" size={16} />
        비교 상품 고르기
      </PickButton>
    </Wrap>
  )
}

export default CompareEmptySlot
