import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import useCompareStore, { getCompareConditionText } from '../../store/useCompareStore'
import { Button, SlotBadge } from '../../styles/common'
import Icon from '../ui/Icon'

// CP-04 빈 비교 칸: 상품 없는 칸 (점선 카드, 시안과 같게)
// [비교 상품 고르기] → 항상 상품 찾기의 상세 검색(/search)으로 보냄. 이 칸과 남은 상품을 기억(setPickSlot)해서 거기서 [+ 비교]를 누르면 이 칸에 들어감
const SEARCH_PATH = '/search'

// 상품 찾기에서 용도와 상환 방식이 겹치는 상품만 보이게 거르는 일은 상품 찾기 화면이 한다 (CM-10, getCompareBlock)
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
  const setPickSlot = useCompareStore((state) => state.setPickSlot)

  // 어디서 비교를 시작했든 항상 상품 찾기의 상세 검색으로 보냄
  // 거기서 [+ 비교]를 누르면 이 빈 칸에 들어가고 비교 화면으로 되돌아옴. 자금 용도와 상환 방식이 맞으면 맞춤 추천, 찜한 대출의 상품도 고를 수 있음
  // (고르는 중 표시는 상품 찾기, 맞춤 추천, 찜한 대출 밖으로 나가면 Layout이 끔)
  const handlePick = () => {
    setPickSlot(slot, keepProduct)
    navigate(SEARCH_PATH)
  }

  return (
    <Wrap>
      <SlotBadge $slot={slot}>{slot}</SlotBadge>
      <Title>텅~ 비어 있어요</Title>
      {keepProduct ? (
        <Hint>
          {keepProduct.productName} 상품과 {getCompareConditionText(keepProduct)}이 겹치는 상품을 골라 주세요.
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
