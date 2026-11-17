import styled from 'styled-components'
import useCompareStore from '../../store/useCompareStore'
import { Tag } from '../../styles/common'
import Icon from '../ui/Icon'

// CM-10 같은 용도 필터 띠: 비교함 용도, 상환 방식 필터 안내 (맞춤 추천, 상품 찾기에 표시)
// '자금 용도와 상환 방식이 겹치는 상품만 보여요' + 비교함 첫 상품의 용도 + 숨긴 개수. 비교함이 비면 띠도 같이 사라진다.
// 실제 목록 거르기는 쓰는 화면이 한다. (canCompare 또는 getCompareBlock 사용: 용도와 상환 방식을 함께 봄). hiddenCount: 거르면서 숨긴 상품 수
const Wrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 16px;
  border-radius: var(--r-sm);
  background: var(--brand-soft);
  color: var(--brand-text);
  font-size: var(--fs-md);
  font-weight: 700;
`

const Count = styled.span`
  margin-left: auto;
  color: var(--cocoa);
  font-weight: 600;
`

function PurposeFilterBanner({ hiddenCount = 0 }) {
  const purposes = useCompareStore((state) => state.tray[0]?.purposes)

  if (!purposes) return null

  return (
    <Wrap role="status">
      <Icon name="compare" size={16} />
      자금 용도와 상환 방식이 겹치는 상품만 보여요
      {purposes.map((purpose) => (
        <Tag key={purpose} $variant="acc">
          {purpose}
        </Tag>
      ))}
      {hiddenCount > 0 && <Count>숨긴 상품 {hiddenCount}개</Count>}
    </Wrap>
  )
}

export default PurposeFilterBanner
